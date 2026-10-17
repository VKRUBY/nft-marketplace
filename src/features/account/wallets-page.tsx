import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { EnsField } from '@/components/ens-field'
import { applyServerErrors, Field } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { User, WalletRole, WalletView } from '@/contracts/domain'
import { NETWORK_LIST, NETWORKS, WALLET_PROVIDER_LIST, WALLET_PROVIDERS } from '@/contracts/networks'
import { walletSchema } from '@/contracts/schemas'
import { useConnectWallet, useDisconnectWallet, useProfile, useWallets } from '@/features/checkout/use-checkout'
import { ApiError } from '@/lib/api/errors'
import { walletsApi } from '@/lib/api/resources'
import { notify } from '@/lib/notices'
import { queryKeys } from '@/lib/query/keys'
import { useDocumentTitle } from '@/lib/use-document-title'
import { cn } from '@/lib/utils'

type WalletForm = z.input<typeof walletSchema>

const FIELDS = ['displayName', 'nickname', 'network', 'profileName', 'address', 'secondaryAddress', 'provider', 'referralCode', 'email', 'ensName'] as const

function emptyForm(role: WalletRole, user: User): WalletForm {
  return {
    role,
    displayName: user.name,
    nickname: role === 'primary' ? (user.walletNickname ?? 'Principal') : 'Reserva',
    network: undefined as unknown as WalletForm['network'],
    profileName: user.username,
    address: '',
    secondaryAddress: '',
    provider: undefined as unknown as WalletForm['provider'],
    referralCode: '',
    email: user.email,
    ensName: user.ensName ?? '',
  }
}

function fromWallet(wallet: WalletView): WalletForm {
  return {
    role: wallet.role,
    displayName: wallet.displayName,
    nickname: wallet.nickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    secondaryAddress: wallet.secondaryAddress ?? '',
    provider: wallet.provider,
    referralCode: wallet.referralCode ?? '',
    email: wallet.email,
    ensName: wallet.ensName ?? '',
  }
}

/** Carteiras (frame Carteiras): principal e secundária, com cadastro, edição e conexão simulada. */
export function WalletsPage({ userId }: { userId: string }) {
  useDocumentTitle('Carteiras — Kurio')
  const wallets = useWallets(userId)
  const profile = useProfile(userId)

  if (wallets.isPending || profile.isPending) {
    return (
      <div role="status" aria-label="Carregando carteiras" className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
    )
  }
  if (wallets.isError || profile.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-bold">Não foi possível carregar as carteiras.</p>
        <p className="text-sm text-sand">{ApiError.from(wallets.error ?? profile.error).message}</p>
        <Button onClick={() => void wallets.refetch()}>Tentar novamente</Button>
      </div>
    )
  }
  const primary = wallets.data.find((w) => w.role === 'primary')
  const secondary = wallets.data.find((w) => w.role === 'secondary')

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">Carteiras</h1>
      <WalletSection walletRole="primary" userId={userId} user={profile.data} wallet={primary} />
      <WalletSection walletRole="secondary" userId={userId} user={profile.data} wallet={secondary} primary={primary} />
    </div>
  )
}

function WalletSection({
  walletRole: role,
  userId,
  user,
  wallet,
  primary,
}: {
  walletRole: WalletRole
  userId: string
  user: User
  wallet: WalletView | undefined
  primary?: WalletView
}) {
  // Como no Figma, a carteira cadastrada aparece já no formulário, pronta para edição.
  const [editing, setEditing] = useState(Boolean(wallet) || role === 'primary')
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const title = role === 'primary' ? 'Carteira principal' : 'Carteira secundária'
  const headingId = `wallet-${role}`

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-lg font-bold">
            {title}
          </h2>
          {role === 'primary' ? (
            <p className="mt-1 text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          ) : (
            !wallet && !editing && <p className="mt-1 text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {role === 'secondary' && !wallet && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 appearance-none rounded-full border border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-accent-strong"
                checked={sameAsPrimary}
                disabled={!primary}
                onChange={(e) => {
                  setSameAsPrimary(e.target.checked)
                  if (e.target.checked) setEditing(true)
                }}
              />
              Igual à carteira principal
            </label>
          )}
          {!editing && (
            <Button variant="link" className="text-base font-bold" onClick={() => setEditing(true)}>
              Adicionar
              <span className="sr-only"> {title.toLowerCase()}</span>
            </Button>
          )}
        </div>
      </div>

      {wallet && <ConnectionBar userId={userId} wallet={wallet} />}
      {editing && (
        <WalletEditor
          key={`${wallet?.id ?? 'new'}-${sameAsPrimary}`}
          userId={userId}
          role={role}
          wallet={wallet}
          initial={wallet ? fromWallet(wallet) : sameAsPrimary && primary ? { ...fromWallet(primary), role, nickname: 'Reserva', address: '' } : emptyForm(role, user)}
          onDone={() => setSameAsPrimary(false)}
          onCancel={!wallet && role === 'secondary' ? () => (setEditing(false), setSameAsPrimary(false)) : undefined}
        />
      )}
    </section>
  )
}

/** Estado da conexão simulada da carteira, com conectar/desconectar. */
function ConnectionBar({ userId, wallet }: { userId: string; wallet: WalletView }) {
  const connect = useConnectWallet(userId)
  const disconnect = useDisconnectWallet(userId)
  const connected = wallet.connection?.status === 'connected'
  const error = connect.error ? ApiError.from(connect.error) : null
  return (
    <div className="mt-5 rounded-md bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <p role="status" className="flex items-center gap-2 text-sm">
          <span aria-hidden className={cn('size-2 rounded-full', connected ? 'bg-success' : 'bg-dust')} />
          {connected ? `Conectada na ${NETWORKS[wallet.connection!.network].label}` : 'Desconectada'}
        </p>
        {connected ? (
          <Button size="sm" variant="outline" onClick={() => disconnect.mutate(wallet.id, { onSuccess: () => notify.info(`${wallet.nickname} desconectada`) })} disabled={disconnect.isPending}>
            Desconectar
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() =>
              connect.mutate(
                { walletId: wallet.id, network: wallet.network },
                { onSuccess: () => notify.success(`${wallet.nickname} conectada`, `Rede ${NETWORKS[wallet.network].label}`) },
              )
            }
            disabled={connect.isPending}
          >
            {connect.isPending ? 'Conectando…' : 'Conectar'}
          </Button>
        )}
        {error && (
          <p role="alert" className="w-full text-sm text-danger">
            {error.message}
          </p>
        )}
      </div>
    </div>
  )
}

function WalletEditor({
  userId,
  role,
  wallet,
  initial,
  onDone,
  onCancel,
}: {
  userId: string
  role: WalletRole
  wallet: WalletView | undefined
  initial: WalletForm
  onDone: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<WalletForm>({ resolver: zodResolver(walletSchema), defaultValues: initial, mode: 'onTouched' })
  const mutation = useMutation({
    mutationFn: (input: z.infer<typeof walletSchema>) => (wallet ? walletsApi.update(wallet.id, input) : walletsApi.create(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.wallets(userId) })
      notify.success(wallet ? 'Carteira atualizada' : 'Carteira adicionada', undefined, `wallet-${role}`)
      onDone()
    },
    onError: (error) => {
      const e = ApiError.from(error)
      if (!applyServerErrors(e.fieldErrors, form.setError, FIELDS)) notify.error('Não foi possível salvar a carteira', e.message, `wallet-${role}`)
    },
  })
  const { errors } = form.formState

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => mutation.mutate(v as z.infer<typeof walletSchema>), () =>
        requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()),
      )}
      className="mt-8 grid gap-x-7 gap-y-6 md:grid-cols-2"
    >
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(p) => <Input {...p} {...form.register('displayName')} />}
      </Field>
      <Field label="Apelido da carteira" required error={errors.nickname?.message}>
        {(p) => <Input {...p} {...form.register('nickname')} />}
      </Field>
      <Field label="Rede" required error={errors.network?.message}>
        {(p) => (
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...p} onBlur={field.onBlur}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent>
                  {NETWORK_LIST.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NETWORKS[n].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Nome do perfil" required error={errors.profileName?.message}>
        {(p) => <Input {...p} {...form.register('profileName')} />}
      </Field>
      <Field label="Endereço da carteira" required error={errors.address?.message}>
        {(p) => <Input {...p} {...form.register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" />}
      </Field>
      <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message} labelClassName="md:invisible">
        {(p) => <Input {...p} {...form.register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
      </Field>
      <Field label="Tipo de carteira" required error={errors.provider?.message}>
        {(p) => (
          <Controller
            control={form.control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...p} onBlur={field.onBlur}>
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent>
                  {WALLET_PROVIDER_LIST.map((w) => (
                    <SelectItem key={w} value={w}>
                      {WALLET_PROVIDERS[w]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Código de indicação (opcional)" error={errors.referralCode?.message}>
        {(p) => <Input {...p} {...form.register('referralCode')} autoCapitalize="characters" />}
      </Field>
      <Field label="E-mail" required error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" />}
      </Field>
      <EnsField form={form as never} />
      <div className="flex gap-3 md:col-span-2">
        <Button type="submit" className="px-3" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar carteira'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
