import { z } from 'zod'
import { isEthString } from '@/shared/eth'

/**
 * Regras de validação compartilhadas pelos formulários (cliente) e pelos
 * handlers MSW (servidor simulado). O servidor revalida tudo: a UI pode ser
 * contornada, a API não.
 */

const required = (label: string) => z.string().trim().min(1, `Informe ${label}`)
const name = required('o nome de exibição').min(2, 'Informe ao menos 2 caracteres').max(60, 'Máximo de 60 caracteres')
export const usernameRule = z
  .string()
  .trim()
  .min(3, 'O nome de usuário precisa de ao menos 3 caracteres')
  .max(24, 'Máximo de 24 caracteres')
  .regex(/^[a-z0-9_.]+$/, 'Use letras minúsculas, números, ponto ou _')
const email = z.string().trim().toLowerCase().min(1, 'Informe o e-mail').email('E-mail inválido')
export const passwordRule = z
  .string()
  .min(8, 'A senha precisa de ao menos 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')
const ensName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, 'Use de 3 a 40 letras, números ou hífen')
const address = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'O endereço deve ter 0x seguido de 40 caracteres hexadecimais')
const optional = <T extends z.ZodType<string | null>>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable())

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
})

export const registerSchema = z
  .object({
    username: usernameRule,
    email,
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })

export const profileSchema = z.object({
  name,
  username: usernameRule,
  email,
  ensName: optional(ensName),
  walletNickname: z.string().trim().min(2, 'Informe ao menos 2 caracteres').max(40, 'Máximo de 40 caracteres'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export const avatarSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie uma imagem PNG, JPG ou WEBP')
    .refine((v) => v.length <= AVATAR_MAX_BYTES * 1.37, 'A imagem deve ter até 2 MB')
    .nullable(),
})

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'], { error: 'Selecione uma rede' })
export const providerSchema = z.enum(['metamask', 'walletconnect', 'coinbase'], {
  error: 'Selecione o tipo de carteira',
})

const walletDetailsShape = {
  displayName: name,
  nickname: required('o apelido da carteira').max(40, 'Máximo de 40 caracteres'),
  network: networkSchema,
  profileName: required('o nome do perfil').max(40, 'Máximo de 40 caracteres'),
  address,
  secondaryAddress: optional(
    z
      .string()
      .trim()
      .regex(/^(0x[a-fA-F0-9]{40}|[a-z0-9-]{3,40}\.eth)$/i, 'Use um endereço 0x ou um nome .eth'),
  ),
  provider: providerSchema,
  referralCode: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{4,16}$/, 'Código de indicação inválido'),
  ),
  email,
  ensName: optional(ensName),
}

export const walletSchema = z.object({
  role: z.enum(['primary', 'secondary']),
  ...walletDetailsShape,
})

export const buyerSchema = z.object({
  displayName: walletDetailsShape.displayName,
  username: usernameRule,
  network: walletDetailsShape.network,
  profileName: walletDetailsShape.profileName,
  address: walletDetailsShape.address,
  secondaryAddress: walletDetailsShape.secondaryAddress,
  provider: walletDetailsShape.provider,
  referralCode: walletDetailsShape.referralCode,
  email,
  ensName: walletDetailsShape.ensName,
  note: optional(z.string().trim().max(500, 'Máximo de 500 caracteres')),
})

export const ethAmount = z.string().refine(isEthString, 'Valor inválido')

export const addCartItemSchema = z.object({
  nftId: z.string().min(1),
  editionId: z.string().min(1),
  quantity: z.number().int('Quantidade deve ser inteira').min(1, 'Mínimo 1'),
})

export const updateCartItemSchema = z.object({
  quantity: z.number().int('Quantidade deve ser inteira').min(1, 'Mínimo 1'),
})

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3, 'Informe um código válido').max(24, 'Código inválido'),
})

export const createOrderSchema = z.object({
  quoteId: z.string().min(1),
  walletId: z.string().min(1),
  network: networkSchema,
  buyer: buyerSchema,
})

/** Converte issues do zod para o formato `fieldErrors` do envelope de erro. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    out[key] ??= issue.message
  }
  return out
}
