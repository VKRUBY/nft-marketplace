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
- *Desvios visuais em relação ao Figma: etapa 2.*
