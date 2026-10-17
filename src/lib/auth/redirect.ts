/** Aceita apenas caminhos internos, evitando open redirect (`//evil.com`, `https://…`). */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.startsWith('/login') || value.startsWith('/cadastro')) return fallback
  return value
}
