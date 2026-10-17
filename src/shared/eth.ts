/**
 * Aritmética decimal para valores em ETH.
 *
 * Valores trafegam como strings decimais ("0.39", "1.250000000000000001").
 * Internamente são convertidos para wei (bigint, 18 casas) para que soma,
 * multiplicação por quantidade inteira e percentuais nunca percam precisão.
 * Nenhuma operação usa `number` para dinheiro.
 */

export const ETH_DECIMALS = 18
const SCALE = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export type EthString = string

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && DECIMAL_RE.test(value)
}

export function toWei(value: EthString): bigint {
  if (!isEthString(value)) throw new Error(`Valor ETH inválido: ${String(value)}`)
  const negative = value.startsWith('-')
  const [intPart = '0', fracPart = ''] = value.replace('-', '').split('.')
  if (fracPart.length > ETH_DECIMALS) {
    throw new Error(`Valor ETH com mais de ${ETH_DECIMALS} casas: ${value}`)
  }
  const wei = BigInt(intPart) * SCALE + BigInt(fracPart.padEnd(ETH_DECIMALS, '0'))
  return negative ? -wei : wei
}

export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function addEth(...values: EthString[]): EthString {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentual em pontos-base (1000 = 10%), arredondado para baixo no wei. */
export function percentOfEth(value: EthString, basisPoints: number): EthString {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export function minEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) <= 0 ? a : b
}

/**
 * Formata para exibição sem passar por float. Arredonda half-up nas casas
 * pedidas e mantém no mínimo `minDecimals` casas ("0.39 ETH").
 */
export function formatEth(value: EthString, { maxDecimals = 4, minDecimals = 2 } = {}): string {
  let wei = toWei(value)
  const negative = wei < 0n
  if (negative) wei = -wei
  const unit = 10n ** BigInt(ETH_DECIMALS - maxDecimals)
  const rounded = ((wei + unit / 2n) / unit) * unit
  const [int, frac = ''] = fromWei(rounded).split('.')
  const fracOut = frac.padEnd(minDecimals, '0')
  return `${negative ? '-' : ''}${int}${fracOut ? `.${fracOut}` : ''}`
}
