import { createFileRoute } from '@tanstack/react-router'
import { OrderStatusPage } from '@/features/orders/order-status-page'

export const Route = createFileRoute('/_auth/pedido/$orderId')({
  component: function OrderRoute() {
    const { session } = Route.useRouteContext()
    const { orderId } = Route.useParams()
    return <OrderStatusPage userId={session.user.id} orderId={orderId} />
  },
})
