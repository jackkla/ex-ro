import type { Token, CollectedWord, LetterPool, Formatting_Letter } from '../types'
import { SCRABBLE_VALUES, FORMATTING_MULTIPLIERS } from '../utils'

export type InventoryManager = {
  addWord: (token: Token) => { success: boolean; reason?: 'at_capacity' }
  scrapWord: (wordId: string) => { letters: Formatting_Letter[] } | { error: 'not_found' }
  getWords: () => CollectedWord[]
  getLetterPool: () => LetterPool
  getCapacity: () => { used: number; max: number }
  setCapacity: (max: number) => void
  clear: () => void
  serialize: () => string
  hydrate: (snapshot: string) => void
}

export function createInventoryManager(initialCapacity = 20): InventoryManager {
  let words: CollectedWord[] = []
  let letterPool: LetterPool = {}
  let maxCapacity = initialCapacity

  function appendLettersToPool(letters: Formatting_Letter[]): void {
    for (const letter of letters) {
      const key = letter.char.toUpperCase()
      if (!letterPool[key]) letterPool[key] = []
      letterPool[key].push(letter)
    }
  }

  return {
    addWord(token) {
      if (words.length >= maxCapacity) {
        return { success: false, reason: 'at_capacity' }
      }
      words.push({ id: crypto.randomUUID(), token, collectedAt: Date.now() })
      return { success: true }
    },

    scrapWord(wordId) {
      const idx = words.findIndex(w => w.id === wordId)
      if (idx === -1) return { error: 'not_found' }

      const [collected] = words.splice(idx, 1)
      const { token } = collected
      const letters: Formatting_Letter[] = token.text.split('').map(char => ({
        char: char.toUpperCase(),
        formatting: token.formatting,
        scrabbleValue: SCRABBLE_VALUES[char.toUpperCase()] ?? 0,
        formattingMultiplier: FORMATTING_MULTIPLIERS[token.formatting] ?? 1,
      }))

      appendLettersToPool(letters)
      return { letters }
    },

    getWords() { return [...words] },

    getLetterPool() {
      const copy: LetterPool = {}
      for (const [key, arr] of Object.entries(letterPool)) {
        copy[key] = [...arr]
      }
      return copy
    },

    getCapacity() { return { used: words.length, max: maxCapacity } },

    setCapacity(max) { maxCapacity = max },

    clear() { words = []; letterPool = {} },

    serialize() {
      return JSON.stringify({ words, letterPool, maxCapacity })
    },

    hydrate(snapshot) {
      const data = JSON.parse(snapshot) as { words?: CollectedWord[]; letterPool?: LetterPool; maxCapacity?: number }
      words = data.words ?? []
      letterPool = data.letterPool ?? {}
      maxCapacity = data.maxCapacity ?? initialCapacity
    },
  }
}
