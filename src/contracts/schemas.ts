import { z } from 'zod'
import { isEthString } from '@/shared/eth'

/**
 * Regras de validação compartilhadas pelos formulários (cliente) e pelos
 * handlers MSW (servidor simulado). O servidor revalida tudo: a UI pode ser
 * contornada, a API não.
 */

const name = z.string().trim().min(2, 'Informe ao menos 2 caracteres').max(80, 'Máximo de 80 caracteres')
const username = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres')
  .max(24, 'Máximo de 24 caracteres')
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _')
const email = z.string().trim().toLowerCase().email('E-mail inválido')
export const passwordRule = z
  .string()
  .min(8, 'A senha precisa de ao menos 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{10,20}$/, 'Telefone inválido')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
})

export const registerSchema = z.object({
  name,
  username,
  email,
  password: passwordRule,
  acceptTerms: z.literal(true, { error: 'Aceite os termos para continuar' }),
})

export const profileSchema = z.object({
  name: name.optional(),
  username: username.optional(),
  email: email.optional(),
  phone: phone.or(z.literal('')).transform((v) => (v === '' ? null : v)).nullable().optional(),
  bio: optionalText(280).optional(),
  country: optionalText(60).optional(),
  city: optionalText(60).optional(),
  website: z
    .string()
    .trim()
    .url('URL inválida')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordRule,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })

export const avatarSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Envie PNG, JPG ou WEBP')
    .refine((v) => v.length <= 2.8 * 1024 * 1024, 'A imagem deve ter até 2 MB'),
})

export const networkSchema = z.enum(['ethereum', 'polygon', 'arbitrum', 'base'])

export const walletSchema = z.object({
  role: z.enum(['primary', 'secondary']),
  label: z.string().trim().min(2, 'Informe ao menos 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  provider: z.enum(['metamask', 'walletconnect', 'coinbase', 'rainbow']),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais'),
  ens: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+\.eth$/, 'ENS deve terminar em .eth')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  networks: z.array(networkSchema).min(1, 'Selecione ao menos uma rede'),
})

export const buyerSchema = z.object({
  name,
  email,
  phone,
  country: z.string().trim().min(2, 'Informe o país'),
  city: z.string().trim().min(2, 'Informe a cidade'),
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
  code: z.string().trim().toUpperCase().min(3, 'Código inválido').max(24, 'Código inválido'),
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
