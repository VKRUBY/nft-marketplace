import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { applyServerErrors, Field, PasswordInput } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { loginSchema, registerSchema } from '@/contracts/schemas'
import { ApiError } from '@/lib/api/errors'
import { authApi } from '@/lib/api/resources'
import { safeRedirect } from '@/lib/auth/redirect'
import { completeAuthentication } from '@/lib/auth/session'
import { notify } from '@/lib/notices'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'
export interface AuthSearch {
  redirect?: string
  reason?: 'expired' | 'required'
}

/**
 * Entrar / Criar conta (frames Login e Cadastro): modal sobre o Início no
 * desktop, tela cheia no mobile. Após autenticar, volta para `redirect`
 * (o fluxo que pediu login) ou para o Início.
 */
export function AuthDialog({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const router = useRouter()
  const target = safeRedirect(search.redirect)
  const close = () => void router.navigate({ to: '/', replace: true })

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        overlayClassName="bg-black/25"
        className={cn(
          'max-w-[500px] px-6 pt-10 pb-10 sm:px-20',
          'max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:border-b-0 max-sm:pt-24',
        )}
        onOpenAutoFocus={(e) => {
          // Foca o primeiro campo (e não o botão de fechar).
          e.preventDefault()
          ;(document.querySelector('[data-autofocus]') as HTMLElement | null)?.focus()
        }}
      >
        <p aria-hidden className="mb-14 text-center text-4xl font-bold tracking-[0.08em] sm:hidden">
          KURIO
        </p>
        <nav aria-label="Entrar ou criar conta" className="flex items-center justify-center gap-2 text-xl max-sm:hidden">
          <Link
            to="/login"
            search={search}
            replace
            aria-current={mode === 'login' ? 'page' : undefined}
            className={mode === 'login' ? 'text-accent-strong' : 'hover:text-accent-strong'}
          >
            Entrar
          </Link>
          <span aria-hidden className="h-6 w-px bg-accent" />
          <Link
            to="/cadastro"
            search={search}
            replace
            aria-current={mode === 'register' ? 'page' : undefined}
            className={mode === 'register' ? 'text-accent-strong' : 'hover:text-accent-strong'}
          >
            Criar conta
          </Link>
        </nav>
        <DialogTitle className="mt-2 text-center text-xl font-bold sm:sr-only">
          {mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}
        </DialogTitle>
        <DialogDescription className="mt-6 text-center text-sm text-cream max-sm:sr-only">
          {mode === 'login'
            ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
            : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {search.reason && (
          <p role="status" className="mt-4 rounded-sm border border-accent bg-band px-3 py-2 text-center text-sm">
            {search.reason === 'expired'
              ? 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
              : 'Entre na sua conta para continuar.'}
          </p>
        )}
        <div className="mt-6">
          {mode === 'login' ? <LoginForm target={target} /> : <RegisterForm target={target} />}
        </div>
        <SocialLogin />
        <p className="mt-10 text-center text-base sm:hidden">
          {mode === 'login' ? (
            <Link to="/cadastro" search={search} replace className="text-sand hover:text-accent-strong">
              Novo na Kurio? Crie uma conta
            </Link>
          ) : (
            <Link to="/login" search={search} replace className="text-sand hover:text-accent-strong">
              Já tem uma conta? Entre
            </Link>
          )}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function useAuthSuccess(target: string) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (response: Awaited<ReturnType<typeof authApi.login>>, message: string) => {
    await completeAuthentication(queryClient, response)
    notify.success(message, undefined, 'auth')
    await router.navigate({ to: target, replace: true })
  }
}

function LoginForm({ target }: { target: string }) {
  const onSuccess = useAuthSuccess(target)
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (r) => onSuccess(r, `Bem-vindo de volta, ${r.session.user.name.split(' ')[0]}!`),
    onError: (error) => {
      const e = ApiError.from(error)
      applyServerErrors(e.fieldErrors, form.setError, ['email', 'password'])
    },
  })
  const apiError = mutation.error ? ApiError.from(mutation.error) : null
  const { errors } = form.formState

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-3">
      <Field label="E-mail" hideLabel required error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} data-autofocus type="email" autoComplete="email" placeholder="contato@email.com" className="h-10 sm:h-10 max-sm:h-[50px] max-sm:rounded-lg" />}
      </Field>
      <Field label="Senha" hideLabel required error={errors.password?.message}>
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="current-password" placeholder="Senha" className="max-sm:h-[50px] max-sm:rounded-lg" />}
      </Field>
      <Link to="/em-breve/$secao" params={{ secao: 'senha-esquecida' }} className="self-end text-sm text-accent-strong hover:underline">
        Esqueceu a senha?
      </Link>
      {apiError && Object.keys(apiError.fieldErrors).length === 0 && (
        <p role="alert" className="text-sm text-danger">
          {apiError.message}
        </p>
      )}
      <Button type="submit" className="mt-4 h-[45px] text-base max-sm:h-[60px] max-sm:rounded-xl" disabled={mutation.isPending}>
        {mutation.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm({ target }: { target: string }) {
  const onSuccess = useAuthSuccess(target)
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (r) => onSuccess(r, 'Conta criada! Bem-vindo à Kurio.'),
    onError: (error) => {
      const e = ApiError.from(error)
      applyServerErrors(e.fieldErrors, form.setError, ['username', 'email', 'password', 'confirmPassword'])
    },
  })
  const apiError = mutation.error ? ApiError.from(mutation.error) : null
  const { errors } = form.formState
  const field = 'max-sm:h-[50px] max-sm:rounded-lg'

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v as z.infer<typeof registerSchema>))} className="flex flex-col gap-3">
      <Field label="Nome de usuário" hideLabel required error={errors.username?.message}>
        {(p) => <Input {...p} {...form.register('username')} data-autofocus autoComplete="username" placeholder="Nome de usuário" className={field} />}
      </Field>
      <Field label="E-mail" hideLabel required error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={field} />}
      </Field>
      <Field label="Senha" hideLabel required error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="new-password" placeholder="Senha" className={field} />}
      </Field>
      <Field label="Confirmar senha" hideLabel required error={errors.confirmPassword?.message}>
        {(p) => <PasswordInput {...p} {...form.register('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" className={field} />}
      </Field>
      {apiError && Object.keys(apiError.fieldErrors).length === 0 && (
        <p role="alert" className="text-sm text-danger">
          {apiError.message}
        </p>
      )}
      {apiError?.code === 'EMAIL_TAKEN' && (
        <p className="text-sm text-sand">
          Já tem conta?{' '}
          <Link to="/login" search={{ redirect: target }} className="text-accent-strong underline">
            Entre com este e-mail
          </Link>
        </p>
      )}
      <Button type="submit" className="mt-3 h-[45px] text-base max-sm:h-[60px] max-sm:rounded-xl" disabled={mutation.isPending}>
        {mutation.isPending ? 'Criando conta…' : (
          <>
            <span className="sm:hidden">Criar perfil</span>
            <span className="max-sm:hidden">Criar conta</span>
          </>
        )}
      </Button>
    </form>
  )
}

/** Login social está fora do escopo: os botões informam isso, sem simular sucesso. */
function SocialLogin() {
  const [message, setMessage] = useState<string | null>(null)
  const providers = [
    { name: 'Google', icon: <GoogleIcon /> },
    { name: 'Facebook', icon: <span aria-hidden className="text-lg font-bold text-[#3b5998]">f</span> },
  ]
  return (
    <div className="mt-8">
      <div className="relative mb-3 text-center text-sm">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line max-sm:inset-x-0 sm:-inset-x-20" />
        <span className="relative bg-surface px-3 max-sm:bg-surface">Ou continue com</span>
      </div>
      <div className="flex flex-col gap-3">
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setMessage(`Entrar com ${p.name} não está disponível nesta versão. Use e-mail e senha.`)}
            className="flex h-10 items-center justify-center gap-2 rounded-sm border border-line text-xs font-medium hover:border-sand"
          >
            {p.icon}
            Continuar com {p.name}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-center text-xs text-sand">
        {message}
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.6 7.3l3.2 2.4C7.6 7.6 9.6 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 8.2 2.2 5 4.3 3.6 7.3z" opacity=".9" />
      <path fill="#FBBC05" d="M12 21.8c2.5 0 4.7-.8 6.2-2.3l-3-2.4c-.8.6-1.9 1-3.2 1-3.9 0-5.3-2.6-5.5-3.8l-3.2 2.5C4.9 19.6 8.2 21.8 12 21.8z" opacity=".9" />
      <path fill="#4285F4" d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.3 2.9l3 2.4c1.8-1.6 3.2-4.1 3.2-7.6z" />
    </svg>
  )
}
