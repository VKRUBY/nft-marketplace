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

## Carrinho

- **Dono:** visitante (`guest:<uuid>`, enviado em `X-Guest-Cart`) ou conta (`user:<id>`, pelo token). O carrinho vive no servidor (banco simulado), então sobrevive a refresh e a outras abas. O uuid do visitante fica em `localStorage`.
- **Login:** `POST /cart/merge` soma os itens do visitante ao carrinho da conta (respeitando estoque e limite por pedido) e o visitante passa a usar um uuid novo.
- **Valores:** subtotal, desconto, taxa de rede e total vêm sempre da API, como strings decimais. O cliente não recalcula nada, só formata para exibição.
- **Mudanças de preço e estoque:** cada item guarda o preço e a disponibilidade aceitos. Quando um `nft.updated` altera algo, a API devolve o item com `issues` (preço mudou, esgotou, quantidade reduzida). A compra fica bloqueada até o usuário aceitar os novos valores (`POST /cart/acknowledge`). A cotação do pagamento segue a mesma regra, e o envio do pedido revalida no servidor (`409 QUOTE_STALE` / `AVAILABILITY_CONFLICT`), exigindo nova confirmação.
- **Cupons:** `PUT /cart/coupon`. Inválido e expirado retornam `422` com mensagem por campo.
- **Após a compra:** o servidor remove do carrinho só as linhas do pedido confirmado (com as quantidades compradas). Itens adicionados depois continuam lá.

## Estratégia de cache

Política global em `src/lib/query/client.ts`, ajustada por consulta:

| Dado | Chave | staleTime | Observações |
| --- | --- | --- | --- |
| Lista do catálogo | `['nfts','list',params]` | 30 s | `keepPreviousData` ao trocar filtros e páginas; eventos atualizam no lugar |
| Destaques | `['nfts','highlights']` | 60 s | atualizados por `nft.updated` |
| Facetas | `['nfts','facets']` | 5 min | mudam raramente |
| Detalhe | `['nfts','detail',idOrSlug]` | 30 s | prefetch no loader da rota; eventos atualizam no lugar |
| Sessão | `['session']` | 60 s | validada no boot; `null` após 401 |
| Carrinho | `['cart',owner,network]` | 15 s | por dono; mutations gravam a resposta da API e invalidam as outras redes |
| Cotação | `['private',uid,'quote',network]` | 60 s | sem refetch no foco (cada busca cria uma cotação); invalidada por eventos de itens do carrinho |
| Pedido | `['private',uid,'orders',id]` | 30 s | polling de 4 s só enquanto `pending`, como rede de segurança do socket |
| Pedidos ativos | `['private',uid,'orders','active']` | 10 s | alimenta o aviso global de pedido pendente |
| Perfil, carteiras, favoritos | `['private',uid,…]` | 30 s | favoritos com atualização otimista e rollback |

- **Retry:** até 2 novas tentativas, só para falhas transitórias (rede, timeout, 5xx com `retryable`), com backoff exponencial até 4 s. 4xx nunca é repetido. Mutations não têm retry automático; a criação de pedido tem retry próprio com a mesma chave de idempotência.
- **Revalidação:** ao focar a janela, ao voltar a conexão e após reconectar o socket (`refetchType: 'active'`).
- **Isolamento:** tudo que é privado fica sob `['private', userId]` e é removido no logout, na expiração e na troca de usuário, junto com o carrinho e o registro de versões de pedidos.
- **Ordem das respostas:** cada consulta é cancelada (`AbortSignal`) quando a chave muda, e o registro de versões impede que uma resposta REST antiga sobrescreva um evento mais novo.

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

## Testes E2E (Playwright)

- `e2e/*.spec.ts`, rodando no Chromium em dois projetos: **desktop** (1440×900) e **mobile** (390×844, toque). Os testes rodam contra o build de produção (`vite preview`) com os mocks ligados, como no deploy.
- **Isolamento:** cada teste usa um `BrowserContext` novo (localStorage, sessionStorage e service worker vazios) e abre o app com `?scenario=<id>&mock-reset=1`. A ordem não importa e os testes rodam em paralelo.
- **Servidor simulado:** os testes mudam preços, estoque, sessões e a conexão pelos controles do MSW (`window.__greenmint`, ver `e2e/fixtures.ts`). A UI reage pelas respostas REST e pelos eventos Socket.IO, sem setters de UI.
- **Cobertura:** catálogo (URL, filtros, ordenação, paginação, vazio, erros, respostas fora de ordem), detalhe (acesso direto, 404, edição indisponível, limite, favoritos), carrinho (CRUD, persistência, ETH, cupons, tempo real), sessão (mescla, expiração com retomada, logout, troca de usuário, hash de senha), pagamento (validação, revisão, carteira, idempotência por cliques e por timeout, confirmado, recusado, preço muda, esgota, remoção parcial do carrinho), tempo real (duplicatas, eventos antigos, reconexão, pedido pendente com refresh, isolamento entre usuários), contratos (envelope de erro, conflito de idempotência, 403, pedido de outra conta, reset), acessibilidade (axe WCAG 2.1 AA, teclado, foco, overflow, zoom, reduced motion) e regressão visual.
- **Regressão visual:** início, detalhe, carrinho e pagamento, nos dois projetos (`e2e/__screenshots__/<projeto>/`). Movimento reduzido, fontes e imagens carregadas, painel de cenários e toasts ocultos. As baselines dependem do renderizador de fontes: gere-as no mesmo ambiente do CI (`npm run test:e2e:update -- visual`).
- **Artefatos:** relatório HTML em `playwright-report/` e trace guardado nas falhas (`retain-on-failure`).

## Performance

Medido com `npm run lighthouse`: Lighthouse CI com 3 execuções por URL e mediana, throttling simulado padrão (mobile: 4G lento, CPU 4×). O resumo fica em `lighthouse-reports/summary.md`.

Mediana de 3 execuções, build de demonstração servido pelo `vite preview` (gzip) em 18/10/2026:

| Página | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início | mobile | **78** | 100 | 100 | 100 | 3,95 s | 0 | 339 ms |
| Detalhe | mobile | **80** | 100 | 100 | 100 | 3,98 s | 0 | 251 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,96 s | 0 | 10 ms |
| Detalhe | desktop | 98 | 100 | 100 | 100 | 1,00 s | 0 | 0 ms |

**Meta não atingida: Perf ≥ 90 no mobile.** As demais metas (A11y ≥ 95, BP ≥ 95, SEO ≥ 90, e Perf no desktop) foram atingidas.

Por que o mobile fica em ~80: o LCP é a imagem do primeiro NFT, que depende dos dados da API. Na demo, a API é o próprio MSW rodando no navegador. O caminho crítico é: HTML → JS do app e dos mocks (~260 KB gzip no total, baixados em paralelo) → avaliação na CPU 4× mais lenta (~2,3 s de main thread no total) → registro do service worker → render → requisição → imagem. Quase todo o LCP é "load delay" (~3 s antes de a imagem começar a baixar). A latência artificial dos cenários não pesa: com `?scenario=fast` o resultado é o mesmo. Em produção, sem o MSW no bundle, esse custo sai do caminho crítico.

O que foi feito (medido antes e depois):
- **Stub do `tough-cookie`** no bundle do MSW (`src/mocks/vendor/tough-cookie-stub.ts`): o MSW só o usa para cookies de `Set-Cookie`, que esta API não emite. O chunk dos mocks caiu de 176 KB para 57 KB gzip.
- **`socket.io-client` sob demanda:** sai do bundle inicial. Isso também permite baixar o app em paralelo com os mocks, em vez de esperar por eles.
- **CLS:** altura mínima no `main`, para o rodapé não aparecer e depois ser empurrado. O detalhe no desktop foi de CLS 0,18 para 0.
- **Alvos de toque** de 24 px nos pontos do carrossel e `robots.txt` (A11y e SEO de 96/92 para 100).

O que foi testado e descartado por piorar a nota:
- **Renderizar antes de os mocks ficarem prontos**, segurando só as requisições: o FCP não melhora, e a avaliação do MSW vira uma tarefa longa depois do primeiro paint (TBT de ~300 para ~420 ms).
- **Tirar as rotas de entrada do code splitting:** elimina uma onda de requisições, mas aumenta a avaliação síncrona (TBT maior, Perf 74–77).

Caminho possível para os 90 no mobile, não implementado: pré-renderizar o HTML da home e do detalhe no build (o seed é determinístico), para o LCP não depender de JS e dos mocks. Ficou de fora porque mostraria preços e estoques estáticos antes da hidratação, em conflito com os requisitos de dados em tempo real.

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
