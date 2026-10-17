import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: '/' | '/mercado' | '/carrinho' }> }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 hidden text-base font-bold md:block">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <li aria-hidden>/</li>}
            <li>
              {item.to && i < items.length - 1 ? (
                <Link to={item.to} className="hover:text-accent-strong">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
