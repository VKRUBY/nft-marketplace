/** PRNG determinístico (mulberry32). Mesma semente → mesma sequência. */
export function createRng(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    hex: (length: number) =>
      Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join(''),
  }
}

export type Rng = ReturnType<typeof createRng>

/** Hash FNV-1a de 32 bits, estável entre execuções; usado em fingerprints. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

let idCounter = 0
/** Identificador único legível; prefixo indica o recurso. */
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000
  const random = crypto.getRandomValues(new Uint32Array(2))
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${random[0]!.toString(36)}`
}
