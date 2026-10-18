# Arquitetura

> Documento vivo — atualizado a cada etapa. Seções marcadas *(etapa N)* serão completadas adiante.

## Visão geral

```
src/
  contracts/   Tipos de domínio, envelope de erro, eventos, rotas e schemas zod — compartilhados por cliente e mocks
  shared/      Utilitários puros (aritmética ETH)
  lib/
    api/       Cliente Axios, ApiError, funções tipadas por recurso
    auth/      Sessão (query, login, logout, limpeza de cache)
    query/     QueryClient e fábrica de chaves
    realtime/  Conexão Socket.IO, registro de versões, sincronização com o cache
  features/    Lógica por domínio (catálogo, carrinho, checkout, conta)
  routes/      Rotas file-based do TanStack Router
  app/         Composição (render, AuthBridge, layout)
  components/  shadcn/ui e componentes compartilhados
  mocks/       Servidor simulado: banco, serviços, handlers MSW, socket, cenários
```

Fluxo de dados: **componentes → TanStack Query → funções tipadas → Axios → (MSW) → serviços simulados → banco simulado**. Eventos: **banco simulado → hub → handler WebSocket do MSW → socket.io-client → registro de versões → cache do Query**. Nenhum componente, hook ou cliente HTTP contém respostas fictícias.

## Contratos REST

Rotas em `src/contracts/endpoints.ts`, tipos em `src/contracts/domain.ts`, validação em `src/contracts/schemas.ts` (os mesmos schemas validam formulários e o servidor simulado).

| Recurso | Rotas |
| --- | --- |
| Sessão | `POST /auth/register` · `POST /auth/login` · `GET /auth/session` · `POST /auth/logout` |
| NFTs | `GET /nfts?q&category&rarity&status&minPrice&maxPrice&sort&page&pageSize` · `GET /nfts/highlights` · `GET /nfts/:idOrSlug` |
| Favoritos | `GET /me/favorites` · `PUT /me/favorites/:nftId` · `DELETE /me/favorites/:nftId` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:id` · `DELETE /cart/items/:id` · `POST /cart/acknowledge` · `PUT /cart/coupon` · `DELETE /cart/coupon` · `POST /cart/merge` |
| Cotação | `POST /checkout/quote` |
| Pedidos | `POST /orders` (+ `Idempotency-Key`) · `GET /orders/active` · `GET /orders/:id` |
| Perfil | `GET /me/profile` · `PATCH /me/profile` · `PUT /me/avatar` · `POST /me/password` |
| Carteiras | `GET /me/wallets` · `POST /me/wallets` · `PATCH /me/wallets/:id` · `POST /me/wallets/:id/connect` · `POST /me/wallets/:id/disconnect` |

### Envelope de erro

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fieldErrors": { "email": "…" }, "details": {}, "retryable": false } }
```

| HTTP | Códigos |
| --- | --- |
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `AVAILABILITY_CONFLICT`, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`, `WALLET_ROLE_TAKEN` |
| 410 | `QUOTE_EXPIRED` |
| 422 | `COUPON_INVALID`, `COUPON_EXPIRED`, `WALLET_REJECTED`, `INVALID_PASSWORD` |
| 503 | `TRANSIENT` (retryable) |

No cliente, toda falha vira `ApiError` (inclui `NETWORK_ERROR`, `TIMEOUT` e `CANCELED`).

### Valores em ETH

Strings decimais em todo o transporte (`"0.39"`). `src/shared/eth.ts` converte para wei (`bigint`, 18 casas) para somar, multiplicar por quantidade inteira e aplicar percentuais sem perda; a formatação arredonda sem passar por `number`. O total exibido no checkout é sempre o da cotação retornada pela API.

### Idempotência de pedidos

`POST /orders` exige `Idempotency-Key`. Mesma chave + mesmo corpo → o mesmo pedido (200). Mesma chave + corpo diferente → `409 IDEMPOTENCY_CONFLICT`. Antes de criar, o servidor recalcula a cotação; se preço, disponibilidade, cupom ou taxa mudaram, responde `409 QUOTE_STALE` (ou `AVAILABILITY_CONFLICT`) com a nova cotação em `details.quote`, e o usuário precisa confirmar de novo.

## Eventos Socket.IO

| Evento | Direção | Payload |
| --- | --- | --- |
| `session.authenticate` | cliente → servidor | `{ token, sessionId }` |
| `session.ready` / `session.rejected` | servidor → cliente | identidade associada / sessão inválida |
| `nft.updated` | servidor → todos | preço, disponibilidade e status por edição |
| `order.updated` | servidor → dono do pedido | status, `txHash`, `explorerUrl`, motivo de recusa |

Envelope: `{ eventId, type, resource: { type, id }, version, occurredAt, data }`. O `eventId` é estável por fato (`evt_nft_<id>_v<versão>`), o que permite descartar duplicatas, e `version` é a versão do recurso após o fato.

### Reconciliação REST × Socket.IO

`src/lib/realtime/versions.ts` mantém a última versão conhecida de cada recurso:
- evento com `eventId` já visto → descartado (duplicata);
- evento com `version` ≤ conhecida → descartado (antigo, sem regressão);
- resposta REST mais antiga que um evento já aplicado recebe o estado do evento por cima (corrida entre requisição e evento);
- após reconexão, as consultas ativas são refeitas via REST, porque eventos podem ter se perdido na queda.

## Sessão

Token em `localStorage` (em produção seria um cookie httpOnly; como a API roda no próprio navegador via MSW, não há servidor para emiti-lo). No boot, `GET /auth/session` valida o token. Um 401 em qualquer chamada autenticada encerra a sessão local e leva ao login com `redirect` para retomar o fluxo. O login mescla o carrinho do visitante. O logout e a troca de usuário removem todo o cache sob `['private', userId]` e o carrinho, e reabrem o socket com a nova identidade. Cada sessão tem a própria instância de socket, então eventos da anterior não chegam à nova.

Retomada de contexto:
- **Expiração** (401 numa chamada ou `session.rejected` no socket): o `AuthBridge` limpa token e cache privado e leva ao login com `redirect=<rota atual>` e `reason=expired`. O rascunho do pagamento (`sessionStorage`, `kurio:checkout-draft:<userId>`) é **mantido**, então o formulário volta preenchido após o novo login. Rotas protegidas (`_auth`) também validam a sessão na navegação.
- **Logout explícito**: além do cache privado, apaga o rascunho do pagamento, que contém dados pessoais.
- **Pedido em andamento**: a chave de idempotência da tentativa fica em `sessionStorage` (`kurio:order-attempt:<userId>`), e `GET /orders/active` alimenta um aviso global "pedido aguardando confirmação" em qualquer página, então refresh, queda do socket ou outra aba não levam a uma segunda compra. Quando o pedido é confirmado ou recusado fora da página dele, um aviso (deduplicado pelo id do pedido) informa o desfecho.

## Acessibilidade

- Navegação SPA: ao mudar de página (pathname), o foco vai para `main#conteudo` e o novo título é anunciado numa região `aria-live` (`RouteAnnouncer`). Mudanças só de filtros e paginação não movem o foco; a paginação leva o foco ao título dos resultados. O carregamento inicial não move o foco, então o primeiro Tab chega ao link "Pular para o conteúdo".
- Diálogos e drawers (Radix): foco preso, Esc fecha, o foco volta ao gatilho. Login e cadastro focam o primeiro campo.
- Formulários: erros ligados por `aria-describedby` com `aria-invalid`; ao enviar inválido, o foco vai ao primeiro campo com erro.
- Edições do NFT: `radiogroup` com setas, e mover com as setas também seleciona (padrão ARIA).
- `prefers-reduced-motion`: shimmer, transições e rolagem suave desligados.
- Verificado com axe (WCAG 2.1 AA) em todas as telas, em 1440 e 390 px, sem overflow horizontal em 320, 390, 768 e 1440 px.

## Estratégia de cache *(detalhes na etapa 4)*

Definida em `src/lib/query/client.ts`: `staleTime` de 30 s; retry só para falhas transitórias (no máximo 2, backoff até 4 s); sem retry automático em mutations (o pedido tem retry próprio com a mesma chave); refetch no foco e na reconexão. As chaves isolam dados públicos por parâmetros e dados privados por usuário (`src/lib/query/keys.ts`).

## Mocks (MSW)

- `src/mocks/db.ts`: estado único (catálogo, contas, favoritos, carrinhos, carteiras, cotações, pedidos), persistido em `localStorage`; `reset()` restaura o seed do cenário ativo.
- `src/mocks/services/*`: regras de negócio do servidor simulado.
- `src/mocks/handlers.ts`: rotas REST; `src/mocks/network.ts`: latência, falhas, timeout, offline e fora de ordem.
- `src/mocks/socket.ts`: servidor Socket.IO simulado.
- `src/mocks/scenarios.ts`: cenários determinísticos (PRNG com semente fixa).

### Transporte do tempo real e limitações

O socket.io-client abre um WebSocket (`transports: ['websocket']`) para `VITE_SOCKET_URL`. O MSW intercepta a conexão e o `@mswjs/socket.io-binding` traduz o protocolo Engine.IO/Socket.IO. Limitações encontradas e como foram tratadas:

1. **Ordem de carregamento:** o engine.io-client guarda `globalThis.WebSocket` no momento do import. Por isso `main.tsx` inicia o MSW antes e só depois importa a aplicação (`app/render.tsx`).
2. **Host próprio:** o MSW remove o prefixo `/socket.io/` da URL do cliente antes de comparar, então o handler aponta para a origem do servidor. Usar a mesma origem da aplicação capturaria o WebSocket de HMR do Vite; daí o host fictício `realtime.greenmint.test`, que não precisa existir porque a interceptação acontece antes de qualquer DNS.
3. **Handshake e autenticação:** o binding aprova o handshake sozinho e ignora `auth`; a identidade é associada pelo evento `session.authenticate`.
4. **Heartbeat:** o binding não envia pings; o mock envia `ping` do Engine.IO a cada 20 s para o cliente não encerrar por timeout.
5. **Sem namespaces, salas nem acks:** o roteamento por usuário fica no hub, e as respostas usam eventos explícitos.
6. **Socket fechado no handshake** (ex.: StrictMode) não dispara `close` no handler; o hub verifica o `readyState` e descarta inscrições órfãs.
7. **Versões:** o binding declara compatibilidade com MSW 2.x; por isso o MSW está fixado em 2.15.
8. **Só WebSocket:** o fallback de long-polling HTTP não é simulado.

## Desvios e decisões

- **shadcn/ui sem CLI:** o registro `ui.shadcn.com` não estava acessível no ambiente de desenvolvimento usado. Os componentes foram escritos a partir do código-fonte canônico do shadcn/ui sobre as mesmas dependências (Radix, cva, tailwind-merge, lucide). `components.json` está no repositório, então `npx shadcn add` funciona em uma máquina com acesso.
- **Playwright:** usa o Chrome estável (`channel: 'chrome'`) quando o Chromium do Playwright não pode ser baixado *(configuração na etapa 4)*.

### Decisões de UX e desvios do Figma

Tokens (cores, Roboto Mono, raios, espaçamentos de 120px/96px) foram extraídos das variáveis do arquivo e de amostras dos frames exportados. Os assets de NFT são os exportados do Figma em 3x e convertidos para WebP em dois tamanhos (`srcset`).

| Ponto do layout | Decisão |
| --- | --- |
| Marca | A interface usa **Kurio** (nome nos frames); "GreenMint" é só o nome da página do arquivo. |
| Contagens da barra lateral (33, 12, 65…) | Vêm da API (`GET /nfts/facets`) e refletem o catálogo simulado de 48 itens. |
| Miniaturas do detalhe | São vistas da mesma obra; a edição é escolhida pelos chips 1/1, 1/10, 1/50, ABERTA. |
| ID do token divergente entre frames (#0009 × #0314) | O ID exibido é sempre o da edição retornada pela API. |
| Rótulos "Rede / Contrato / Direitos autorais" trocados no detalhe | Cada rótulo mostra o conteúdo correspondente. |
| Seletor ".eth" do Nome ENS | ENS só tem o sufixo `.eth`: ele fica fixo e só o nome é editável. |
| Asteriscos em "Código de indicação" e "Nome ENS" | Opcionais: nem toda carteira tem ENS ou indicação, e exigir bloquearia a compra sem motivo. |
| Formulário do pagamento no mobile (não desenhado) | Aparece recolhido abaixo da seleção de carteira, já pré-preenchido; erros de validação o abrem e focam o campo. |
| "Usar outra carteira?" | Alterna para a carteira secundária cadastrada (ou leva ao cadastro dela). |
| Botão "COMPRAR" | Adiciona a edição/quantidade ao carrinho e abre o carrinho; no mobile o ícone de carrinho adiciona sem sair. |
| Pendente e recusado (não desenhados) | Seguem o modal da confirmação, com ícone, texto e ações próprios. |
| Revisão antes do envio (não desenhada) | Diálogo no padrão dos modais (barra laranja), exigido pelo enunciado. |
| Perfil com um botão "Salvar" | Dados e senha têm envios separados, para um erro de senha não descartar a edição do perfil. |
| Carteiras | O formulário mostra a carteira cadastrada; acima dele há o estado da conexão simulada (conectar/desconectar). |
| Coração nos cards | Só no mobile, como nos frames; no desktop o favorito fica no detalhe. |
| Carrossel "Mais desta coleção" com pontos | Faixa com rolagem horizontal acessível por teclado e toque. |
| Overlay do login | Escurecimento leve para manter o foco no modal sem esconder o Início ao fundo. |
| Botão central da barra inferior mobile | Leva ao catálogo ("Explorar"); não há função de leitura de QR no escopo. |
| Itens fora do escopo (Criadores, Aprenda, Diário, Ajuda, Atividade, Ofertas, Downloads, Suporte, newsletter, login social, recuperação de senha) | Levam a uma página "Em breve" ou mostram aviso explícito; nenhuma ação simula sucesso. |
