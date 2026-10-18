import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/use-document-title'
import { OUT_OF_SCOPE, type OutOfScopeSection } from '@/components/layout/out-of-scope'

/** Seções do layout fora do escopo desta entrega: informam isso com clareza. */
export const Route = createFileRoute('/em-breve/$secao')({
  component: function SoonPage() {
    const { secao } = Route.useParams()
    const title = OUT_OF_SCOPE[secao as OutOfScopeSection] ?? 'Esta seção'
    useDocumentTitle(`${title} (em breve) — Kurio`)
    return (
      <section aria-labelledby="soon-title" className="container-page flex flex-col items-start gap-4 py-20">
        <p className="text-sm text-sand">Em breve</p>
        <h1 id="soon-title" className="text-2xl font-bold">
          {title}
        </h1>
        <p className="max-w-xl text-sand">
          Esta área ainda não está disponível nesta versão da Kurio. Nada foi enviado ou salvo. Você pode continuar explorando o catálogo.
        </p>
        <Button asChild>
          <Link to="/" hash="catalogo">
            Ir para o catálogo
          </Link>
        </Button>
      </section>
    )
  },
})
