import { FlaskConicalIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { notify } from '@/lib/notices'
import { percentOfEth, addEth } from '@/shared/eth'

/**
 * Painel de cenários da demo. Só existe quando a camada de mocks está ligada
 * (`window.__greenmint` presente) e age exclusivamente pelos controles do
 * servidor simulado: troca de cenário, reset e eventos de "servidor"
 * (preço, estoque, queda do socket, sessão). A aplicação percebe tudo pelos
 * mesmos caminhos de produção — REST e Socket.IO —, nunca por setters de UI.
 */
export function ScenarioPanel() {
  // Os mocks iniciam antes do primeiro render (main.tsx).
  const available = typeof window !== 'undefined' && Boolean(window.__greenmint)
  const [open, setOpen] = useState(false)
  if (!available) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-scenario-trigger
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-2 text-xs font-bold text-sand shadow-lg backdrop-blur hover:text-cream focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none max-md:top-[45%] max-md:bottom-auto max-md:left-0 max-md:rounded-l-none max-md:border-l-0 max-md:p-2.5"
        >
          <FlaskConicalIcon className="size-4" aria-hidden />
          {/* No mobile, só o ícone: evita disputar espaço com o aviso de conexão. */}
          <span className="max-md:sr-only">Cenários</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(92vw,400px)] overflow-y-auto p-5">
        {open && <PanelBody />}
      </SheetContent>
    </Sheet>
  )
}

function PanelBody() {
  const controls = window.__greenmint!
  const current = controls.getScenario()
  const [scenarioId, setScenarioId] = useState(current.id)
  const selected = controls.scenarios.find((s) => s.id === scenarioId)
  const nfts = controls.snapshot().nfts.slice(0, 10)
  const [nftId, setNftId] = useState(() => nftFromPath(nfts) ?? nfts[0]?.id ?? '')
  const nft = nfts.find((n) => n.id === nftId)
  const [editionId, setEditionId] = useState(nft?.editions[0]?.id ?? '')
  const edition = nft?.editions.find((e) => e.id === editionId) ?? nft?.editions[0]
  const [blocked, setBlocked] = useState(false)
  const ids = { scenario: useId(), nft: useId(), edition: useId() }

  const act = (label: string, run: () => unknown) => () => {
    run()
    notify.info('Servidor simulado', label, 'scenario-panel')
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <SheetTitle className="text-lg font-bold">Cenários da demo</SheetTitle>
        <SheetDescription className="mt-1 text-sand">
          Controla o servidor simulado (MSW). A interface reage pelas mesmas respostas REST e eventos em tempo real de produção.
        </SheetDescription>
      </div>

      <Group title="Cenário">
        <p>
          Ativo: <strong className="text-accent-strong">{current.label}</strong>
        </p>
        <label htmlFor={ids.scenario} className="font-bold">
          Trocar para
        </label>
        <select id={ids.scenario} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={selectClass} aria-describedby={`${ids.scenario}-desc`}>
          {controls.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p id={`${ids.scenario}-desc`} className="text-xs text-sand">
          {selected?.description}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              controls.setScenario(scenarioId)
              window.location.reload()
            }}
          >
            Aplicar e recarregar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              controls.reset()
              window.location.reload()
            }}
          >
            Restaurar dados iniciais
          </Button>
        </div>
        <p className="text-xs text-dust">Trocar ou restaurar recria o banco simulado (carrinhos, pedidos e sessões).</p>
      </Group>

      <Group title="Catálogo em tempo real">
        <label htmlFor={ids.nft} className="font-bold">
          NFT
        </label>
        <select
          id={ids.nft}
          value={nftId}
          onChange={(e) => {
            setNftId(e.target.value)
            setEditionId(nfts.find((n) => n.id === e.target.value)?.editions[0]?.id ?? '')
          }}
          className={selectClass}
        >
          {nfts.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <label htmlFor={ids.edition} className="font-bold">
          Edição
        </label>
        <select id={ids.edition} value={edition?.id ?? ''} onChange={(e) => setEditionId(e.target.value)} className={selectClass}>
          {nft?.editions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label} — {e.priceEth} ETH · {e.available} disp.
            </option>
          ))}
        </select>
        {nft && edition && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={act('Preço subiu 10%.', () =>
                controls.updateEdition(nft.id, edition.id, { priceEth: addEth(edition.priceEth, percentOfEth(edition.priceEth, 1000)) }),
              )}
            >
              Subir preço 10%
            </Button>
            <Button size="sm" variant="outline" onClick={act('Edição esgotada.', () => controls.updateEdition(nft.id, edition.id, { available: 0 }))}>
              Esgotar edição
            </Button>
            <Button size="sm" variant="outline" onClick={act('Estoque reposto.', () => controls.updateEdition(nft.id, edition.id, { available: 5 }))}>
              Repor estoque
            </Button>
            <Button size="sm" variant="outline" onClick={act('Último evento reenviado (duplicado).', () => controls.replayNftEvent(nft.id, 'last'))}>
              Evento duplicado
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="col-span-2"
              onClick={act('Versão antiga reenviada; deve ser ignorada.', () => controls.replayNftEvent(nft.id, 'previous'))}
            >
              Reenviar evento antigo
            </Button>
          </div>
        )}
      </Group>

      <Group title="Conexão e sessão">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={act('Conexão em tempo real derrubada; o cliente reconecta e reconcilia.', () => controls.dropRealtime())}>
            Derrubar socket
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={blocked}
            onClick={act(blocked ? 'Tempo real liberado.' : 'Tempo real bloqueado: reconexões falham.', () => {
              controls.setRealtimeBlocked(!blocked)
              if (!blocked) controls.dropRealtime()
              setBlocked(!blocked)
            })}
          >
            {blocked ? 'Liberar socket' : 'Bloquear socket'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="col-span-2"
            onClick={act('Sessões expiradas: a próxima ação autenticada pede login.', () => controls.expireSessions())}
          >
            Expirar sessão
          </Button>
        </div>
      </Group>
    </div>
  )
}

const selectClass =
  'h-10 w-full rounded-sm border border-line bg-field px-2 text-cream outline-none focus-visible:ring-2 focus-visible:ring-accent-strong'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-xs font-bold tracking-wide text-dust uppercase">{title}</h3>
      {children}
    </section>
  )
}

function nftFromPath(nfts: { id: string; slug: string }[]): string | undefined {
  const match = /^\/nft\/([^/]+)/.exec(window.location.pathname)
  if (!match) return undefined
  const key = decodeURIComponent(match[1]!)
  return nfts.find((n) => n.slug === key || n.id === key)?.id
}
