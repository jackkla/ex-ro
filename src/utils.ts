import type { Formatting, Formatting_Letter, LetterPool } from './types'

export const SCRABBLE_VALUES: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
}

export const FORMATTING_MULTIPLIERS: Record<Formatting, number> = {
  plain: 1,
  wikilink: 1,
  subscript: 2,
  superscript: 2,
  italic: 3,
  bold: 5,
  'bold-italic': 5,
  'heading-1': 10,
  'heading-2': 10,
  'heading-3': 10,
}

// Consumption order: least valuable first (plain=0 → italic=1 → bold=2 → heading=3)
const DEDUCTION_ORDER: Record<Formatting, number> = {
  plain: 0,
  wikilink: 0,
  subscript: 1,
  superscript: 1,
  italic: 2,
  bold: 3,
  'bold-italic': 3,
  'heading-1': 4,
  'heading-2': 4,
  'heading-3': 4,
}

export function sortLettersByDeductionOrder(letters: Formatting_Letter[]): Formatting_Letter[] {
  return [...letters].sort(
    (a, b) => (DEDUCTION_ORDER[a.formatting] ?? 0) - (DEDUCTION_ORDER[b.formatting] ?? 0),
  )
}

/**
 * Deduct `cost` copies of each unique letter in `word` from `pool`.
 * Consumes cheapest formatting first. Returns a new pool (does not mutate input).
 */
export function deductLettersFromPool(
  word: string,
  pool: LetterPool,
  cost: number,
): LetterPool {
  const uniqueChars = [...new Set(word.toUpperCase().split('').filter(c => /[A-Z]/.test(c)))]
  const updated: LetterPool = {}
  for (const [char, letters] of Object.entries(pool)) {
    updated[char] = [...letters]
  }
  for (const char of uniqueChars) {
    const letters = sortLettersByDeductionOrder(updated[char] ?? [])
    updated[char] = letters.slice(cost)
    if (updated[char].length === 0) delete updated[char]
  }
  return updated
}

/**
 * Check whether `pool` contains at least `cost` copies of each unique letter in `word`.
 * Returns shortfall map (empty if affordable).
 */
export function checkLetterShortfall(
  word: string,
  pool: LetterPool,
  cost: number,
): Record<string, number> {
  const uniqueChars = [...new Set(word.toUpperCase().split('').filter(c => /[A-Z]/.test(c)))]
  const shortfall: Record<string, number> = {}
  for (const char of uniqueChars) {
    const available = pool[char]?.length ?? 0
    if (available < cost) shortfall[char] = cost - available
  }
  return shortfall
}
