# GreenMint — NFT Marketplace

Marketplace de NFTs em React + TypeScript com descoberta, compra e conta do colecionador. Toda a API (REST e Socket.IO) é simulada no navegador com MSW, então o projeto roda a partir de um checkout limpo, sem backend.

> Status: **etapa 1 de 4** — contratos, mocks, tempo real e integração de dados prontos; telas finais (Figma) nas etapas 2 e 3; testes Playwright, Lighthouse e documentação final na etapa 4.

## Stack

React 19 · TypeScript (strict) · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS 4 · shadcn/ui (Radix) · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse CI

## Setup

Requer Node.js 22+.

```bash
npm ci
npm run dev        # http://localhost:5173 (mocks ligados)
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado (mocks incluídos) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Testes Playwright *(etapa 4)* |
| `npm run lighthouse` | Auditoria Lighthouse CI *(etapa 4)* |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se quiser mudar algo — todas têm padrão.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (inclusive no build de demonstração) |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial dos mocks |
| `VITE_API_URL` | `/api` | Base da API REST |
| `VITE_SOCKET_URL` | `https://realtime.greenmint.test` | Servidor Socket.IO (host fictício interceptado pelo MSW) |
| `VITE_HTTP_TIMEOUT_MS` | `10000` | Timeout do Axios |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Ribeiro (2 carteiras, favoritos) | `ana@greenmint.test` | `Mint@2026` |
| Bruno Costa (1 carteira) | `bruno@greenmint.test` | `Mint@2026` |

Cupons: `GREEN10` (10%), `MINT25` (25%), `EXPIRADO` (vencido). Qualquer outro código é inválido.

## Cenários dos mocks

Selecione pela URL — o cenário fica salvo e sobrevive a refresh:

```
http://localhost:5173/?scenario=price-change
http://localhost:5173/?scenario=price-change&mock-reset=1   # também restaura o banco simulado
```

| Cenário | Comportamento |
| --- | --- |
| `default` | Latência 120–450 ms; pagamento confirmado em ~3 s |
| `fast` | Sem latência (testes) |
| `slow` | 2–3,5 s por resposta (skeletons) |
| `variable` | 50 ms–2,5 s |
| `out-of-order` | Na listagem, requisições ímpares demoram mais que as pares |
| `empty` | Catálogo vazio |
| `offline` | Toda requisição falha como erro de rede |
| `flaky` | Primeira chamada à listagem e ao detalhe responde 503 |
| `server-error` | Listagem responde 500 |
| `favorite-fails` | Primeira mutation de favorito falha (rollback otimista) |
| `session-expired` | Sessão expira 45 s após o login |
| `forbidden` | Rotas `/me/*` respondem 403 |
| `price-change` | Preço do 1º item do carrinho sobe 3 s após a 1ª cotação |
| `sold-out` | Edição do 1º item esgota no envio do pedido |
| `order-timeout` | Pedido é criado, mas a resposta chega depois do timeout |
| `payment-declined` | Todo pedido termina recusado |
| `slow-payment` | Pedido fica pendente por 20 s |
| `wallet-rejected` | Conexão da carteira é recusada |
| `realtime-chaos` | Eventos duplicados e antigos |

### Controles de teste

Com os mocks ligados, `window.__greenmint` expõe ações que passam pelo banco simulado e chegam à aplicação pelos mesmos caminhos de produção (REST via MSW e eventos via socket.io-client):

```js
__greenmint.setScenario('payment-declined')
__greenmint.reset()
__greenmint.updateEdition('nft_001', 'ed_0_0', { priceEth: '1.25', available: 0 })
__greenmint.replayNftEvent('nft_001', 'last')      // duplicata
__greenmint.replayNftEvent('nft_001', 'previous')  // evento antigo
__greenmint.dropRealtime()                          // derruba o socket
__greenmint.expireSessions()                        // expira sessões
```

## Deploy

`vercel.json` configura o fallback de SPA (acesso direto e refresh em qualquer rota) e os cabeçalhos do service worker do MSW. Importe o repositório na Vercel; não há variáveis obrigatórias.

Arquitetura, contratos e decisões: [ARCHITECTURE.md](./ARCHITECTURE.md).
