import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/checkout-page'

export const Route = createFileRoute('/_auth/pagamento')({
  component: function PaymentRoute() {
    const { session } = Route.useRouteContext()
    return <CheckoutPage key={session.user.id} session={session} />
  },
})
