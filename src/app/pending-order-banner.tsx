import { Link, useRouterState } from '@tanstack/react-router'
import { useActiveOrders } from '@/features/checkout/use-checkout'
import { useSession } from '@/lib/auth/session'

/**
 * Pedido pendente de uma sessão anterior (refresh, queda de conexão, outra
 * aba): a API informa via GET /orders/active e o usuário retoma o
 * acompanhamento sem criar outra compra.
 */
export function PendingOrderBanner() {
  const { user } = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data } = useActiveOrders(user?.id)
  const order = data?.[0]
  if (!order || pathname.startsWith('/pedido') || pathname.startsWith('/pagamento')) return null
  return (
    <div role="status" className="container-page mt-3">
      <p className="flex flex-wrap items-center gap-3 rounded-md border border-accent bg-band px-4 py-2 text-sm">
        Você tem um pedido aguardando confirmação na rede.
        <Link to="/pedido/$orderId" params={{ orderId: order.id }} className="font-bold text-accent-strong underline">
          Acompanhar pedido
        </Link>
      </p>
    </div>
  )
}
