import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFound({ title = 'Página não encontrada' }: { title?: string }) {
  return (
    <section aria-labelledby="nf-title" className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-sm text-muted-foreground">Erro 404</p>
      <h1 id="nf-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p className="max-w-md text-muted-foreground">O endereço pode ter mudado ou o conteúdo não existe mais.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
