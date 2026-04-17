import type { Token, CollectedWord, LetterPool, TravelHistory, ArticleTitle } from '../types'
import { checkLetterShortfall, deductLettersFromPool } from '../utils'

export type TravelResult =
  | { success: true; destination: ArticleTitle; updatedLetterPool: LetterPool; updatedHistory: TravelHistory }
  | { success: false; reason: 'insufficient_letters' | 'not_a_wikilink' | 'unknown_verb' }

export type TravelManager = {
  getAvailableLinks: (collectedWords: CollectedWord[], revealedTokenIds: Set<string>) => CollectedWord[]
  getTravelCost: (verb: string, travelHistory: TravelHistory) => number
  canAfford: (verb: string, letterPool: LetterPool, travelHistory: TravelHistory) => boolean
  travel: (linkToken: Token, verb: string, letterPool: LetterPool, travelHistory: TravelHistory) => TravelResult
  discoverVerb: (token: Token) => string
}

const DEFAULT_VERB = 'travel'

export function createTravelManager(): TravelManager {
  return {
    getAvailableLinks(collectedWords, revealedTokenIds) {
      return collectedWords.filter(w => w.token.isWikilink && revealedTokenIds.has(w.token.id))
    },

    getTravelCost(verb, travelHistory) {
      return (travelHistory[verb] ?? 0) + 1
    },

    canAfford(verb, letterPool, travelHistory) {
      const isKnown = verb === DEFAULT_VERB || verb in travelHistory
      if (!isKnown) return false
      const cost = (travelHistory[verb] ?? 0) + 1
      return Object.keys(checkLetterShortfall(verb, letterPool, cost)).length === 0
    },

    travel(linkToken, verb, letterPool, travelHistory) {
      if (!linkToken.isWikilink) {
        return { success: false, reason: 'not_a_wikilink' }
      }

      const isKnown = verb === DEFAULT_VERB || verb in travelHistory
      if (!isKnown) {
        return { success: false, reason: 'unknown_verb' }
      }

      const cost = (travelHistory[verb] ?? 0) + 1
      const shortfall = checkLetterShortfall(verb, letterPool, cost)
      if (Object.keys(shortfall).length > 0) {
        return { success: false, reason: 'insufficient_letters' }
      }

      const updatedLetterPool = deductLettersFromPool(verb, letterPool, cost)
      const updatedHistory: TravelHistory = { ...travelHistory, [verb]: cost }
      // wikilinkTarget is guaranteed present when isWikilink is true
      const destination = linkToken.wikilinkTarget!

      return { success: true, destination, updatedLetterPool, updatedHistory }
    },

    // Normalises a collected token into a travel verb; caller adds it to travelHistory at count 0
    discoverVerb(token) {
      return token.text.toLowerCase()
    },
  }
}
