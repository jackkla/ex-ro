import type { LetterPool, CraftHistory, StampShape } from '../types'
import { checkLetterShortfall, deductLettersFromPool } from '../utils'

export type CraftResult =
  | { success: true; stamp: StampShape; updatedLetterPool: LetterPool; updatedHistory: CraftHistory; cost: number }
  | { success: false; reason: 'insufficient_letters'; shortfall: Record<string, number>; cost: number }

export async function craft(
  word: string,
  letterPool: LetterPool,
  craftHistory: CraftHistory,
  getShape: (word: string) => Promise<StampShape>,
): Promise<CraftResult> {
  const normalized = word.toLowerCase()
  const cost = (craftHistory[normalized] ?? 0) + 1

  const shortfall = checkLetterShortfall(normalized, letterPool, cost)
  if (Object.keys(shortfall).length > 0) {
    return { success: false, reason: 'insufficient_letters', shortfall, cost }
  }

  const updatedLetterPool = deductLettersFromPool(normalized, letterPool, cost)
  const updatedHistory: CraftHistory = { ...craftHistory, [normalized]: cost }
  const stamp = await getShape(normalized)

  return { success: true, stamp, updatedLetterPool, updatedHistory, cost }
}
