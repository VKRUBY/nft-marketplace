import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { applyServerErrors, Field, PasswordInput } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Session, User } from '@/contracts/domain'
import { AVATAR_MAX_BYTES, passwordChangeSchema, profileSchema } from '@/contracts/schemas'
import { EnsField } from '@/components/ens-field'
import { useProfile } from '@/features/checkout/use-checkout'
import { ApiError } from '@/lib/api/errors'
import { profileApi } from '@/lib/api/resources'
import { notify } from '@/lib/notices'
import { queryKeys } from '@/lib/query/keys'
import { useDocumentTitle } from '@/lib/use-document-title'

function useSyncUser() {
  const queryClient = useQueryClient()
  return (user: User) => {
    queryClient.setQueryData(queryKeys.private.profile(user.id), user)
    queryClient.setQueryData<Session | null>(queryKeys.session, (s) => (s ? { ...s, user } : s))
  }
}

export function ProfilePage({ userId }: { userId: string }) {
  useDocumentTitle('Perfil do colecionador — Kurio')
  const profile = useProfile(userId)
  if (profile.isPending) {
    return (
      <div role="status" aria-label="Carregando perfil" className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
    )
  }
  if (profile.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-bold">Não foi possível carregar o perfil.</p>
        <p className="text-sm text-sand">{ApiError.from(profile.error).message}</p>
        <Button onClick={() => void profile.refetch()}>Tentar novamente</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-10">
      <ProfileForm user={profile.data} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const sync = useSyncUser()
  const defaults = {
    name: user.name,
    username: user.username,
    email: user.email,
    ensName: user.ensName ?? '',
    walletNickname: user.walletNickname ?? '',
  }
  const form = useForm<z.input<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: defaults })
  useEffect(() => form.reset(defaults), [user.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const mutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (updated) => {
      sync(updated)
      notify.success('Perfil atualizado', undefined, 'profile')
    },
    onError: (error) => {
      const e = ApiError.from(error)
      if (!applyServerErrors(e.fieldErrors, form.setError, ['name', 'username', 'email', 'ensName', 'walletNickname'])) {
        notify.error('Não foi possível salvar o perfil', e.message, 'profile')
      }
    },
  })
  const { errors, isDirty } = form.formState

  return (
    <section aria-labelledby="profile-title">
      <h1 id="profile-title" className="mb-8 text-lg font-bold">
        Perfil do colecionador
      </h1>
      <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v as z.infer<typeof profileSchema>))} className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.name?.message}>
          {(p) => <Input {...p} {...form.register('name')} autoComplete="name" />}
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          {(p) => <Input {...p} {...form.register('username')} autoComplete="username" />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" />}
        </Field>
        <EnsField form={form as never} />
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          {(p) => <Input {...p} {...form.register('walletNickname')} />}
        </Field>
        <AvatarEditor user={user} />
        <div className="md:col-span-2">
          <Button type="submit" className="w-[180px]" disabled={mutation.isPending || !isDirty}>
            {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </section>
  )
}

/** Reduz a imagem para 256×256 (WEBP) antes do envio. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const side = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/webp', 0.85)
}

function AvatarEditor({ user }: { user: User }) {
  const sync = useSyncUser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (dataUrl: string | null) => profileApi.avatar({ dataUrl }),
    onSuccess: (updated, dataUrl) => {
      sync(updated)
      notify.success(dataUrl ? 'Avatar atualizado' : 'Avatar removido', undefined, 'avatar')
    },
    onError: (e) => setError(ApiError.from(e).fieldErrors.dataUrl ?? ApiError.from(e).message),
  })

  return (
    <div className="flex flex-col gap-2">
      <p id="avatar-label" className="text-base">
        Avatar
      </p>
      <div className="flex items-center gap-6">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`Avatar de ${user.name}`} width={50} height={50} className="size-[50px] rounded-full object-cover" />
        ) : (
          <span className="grid size-[50px] place-items-center rounded-full border border-line bg-band text-sand" role="img" aria-label="Sem avatar">
            <ImageIcon className="size-5" aria-hidden />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-labelledby="avatar-label"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            setError(null)
            if (!file) return
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Envie uma imagem PNG, JPG ou WEBP.')
            if (file.size > AVATAR_MAX_BYTES) return setError('A imagem deve ter até 2 MB.')
            try {
              mutation.mutate(await toAvatarDataUrl(file))
            } catch {
              setError('Não foi possível ler esta imagem.')
            }
          }}
        />
        <Button type="button" className="h-10 px-6" onClick={() => inputRef.current?.click()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button type="button" variant="ghost" className="font-normal" onClick={() => mutation.mutate(null)} disabled={!user.avatarUrl || mutation.isPending}>
          Remover
        </Button>
      </div>
      <p role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
    </div>
  )
}

function PasswordForm() {
  const form = useForm<z.input<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      form.reset()
      notify.success('Senha alterada', 'Use a nova senha no próximo login.', 'password')
    },
    onError: (error) => {
      const e = ApiError.from(error)
      if (!applyServerErrors(e.fieldErrors, form.setError, ['currentPassword', 'newPassword', 'confirmPassword'])) {
        notify.error('Não foi possível alterar a senha', e.message, 'password')
      }
    },
  })
  const { errors } = form.formState
  return (
    <section aria-labelledby="password-title" className="max-w-[417px]">
      <h2 id="password-title" className="mb-4 text-lg font-bold">
        Alterar senha
      </h2>
      <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5">
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          {(p) => <PasswordInput {...p} {...form.register('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(p) => <PasswordInput {...p} {...form.register('newPassword')} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          {(p) => <PasswordInput {...p} {...form.register('confirmPassword')} autoComplete="new-password" />}
        </Field>
        <Button type="submit" className="w-[180px]" disabled={mutation.isPending}>
          {mutation.isPending ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}
