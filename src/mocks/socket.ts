import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { RealtimeEvent } from '@/contracts/events'
import { isRealtimeBlocked, registerDisconnector, subscribe } from './realtime-hub'
import { userIdForToken } from './services/auth'

/**
 * Servidor Socket.IO simulado sobre o interceptador de WebSocket do MSW.
 *
 * O socket.io-client da aplicação abre um WebSocket real
 * (`transports: ['websocket']`); o MSW intercepta a conexão e o
 * `@mswjs/socket.io-binding` codifica/decodifica o protocolo Engine.IO +
 * Socket.IO. Limitações do binding e como são tratadas:
 *  - o handshake é aprovado automaticamente e ignora `auth` → a sessão é
 *    associada pelo evento `session.authenticate`;
 *  - não há heartbeat do lado do servidor → enviamos `ping` do Engine.IO
 *    periodicamente, senão o cliente encerra por "ping timeout";
 *  - não há namespaces, salas nem acks → o roteamento por usuário é feito
 *    no hub e as respostas usam eventos explícitos;
 *  - só o transporte WebSocket é suportado (sem long-polling HTTP).
 */

const PING_INTERVAL_MS = 20_000

/**
 * Host próprio do tempo real. O MSW remove o prefixo `/socket.io/` da URL do
 * cliente antes de comparar, então o link aponta para a origem do servidor.
 * Usar um host separado evita capturar o WebSocket de HMR do Vite (mesma
 * origem da aplicação). Como o MSW intercepta antes de qualquer DNS, o host
 * não precisa existir.
 */
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || 'https://realtime.greenmint.test'

export const realtime = ws.link(SOCKET_URL.replace(/^http/, 'ws'))


export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    if (isRealtimeBlocked()) {
      connection.client.close(1013, 'Indisponível')
      return
    }

    const io = toSocketIo(connection)
    // `socket` existe na implementação (WebSocketClientConnection), mas não no tipo do protocolo.
    const clientReadyState = () =>
      (connection.client as unknown as { socket?: WebSocket }).socket?.readyState ?? WebSocket.OPEN
    let userId: string | null = null
    let closed = false

    const unsubscribe = subscribe({
      userId: () => userId,
      send: (event: RealtimeEvent) => {
        if (!closed) io.client.emit(event.type, event)
      },
      alive: () => !closed && clientReadyState() <= WebSocket.OPEN,
      dispose: () => cleanup(),
    })

    // Heartbeat Engine.IO: "2" = ping; o cliente responde "3" (pong).
    const ping = setInterval(() => {
      if (!closed) connection.client.send('2')
    }, PING_INTERVAL_MS)

    const cleanup = () => {
      if (closed) return
      closed = true
      clearInterval(ping)
      unsubscribe()
      unregister()
    }

    const unregister = registerDisconnector(() => {
      cleanup()
      connection.client.close(1001, 'Servidor reiniciado')
    })

    connection.client.addEventListener('close', cleanup)

    io.client.on('session.authenticate', (_event, payload: { token: string | null; sessionId: string }) => {
      const resolved = userIdForToken(payload?.token ?? null)
      if (payload?.token && !resolved) {
        userId = null
        io.client.emit('session.rejected', { reason: 'SESSION_EXPIRED' })
        return
      }
      userId = resolved
      io.client.emit('session.ready', { userId, sessionId: payload?.sessionId ?? '' })
    })
  }),
]
