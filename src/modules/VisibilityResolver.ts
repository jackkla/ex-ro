import type { TokenizedArticle, CollectedWord, VisibilityMap, TokenId } from '../types'

export function resolveVisibility(
  article: TokenizedArticle,
  collectedWords: CollectedWord[],
  revealedTokenIds: Set<TokenId>,
): VisibilityMap {
  const collectedTexts = new Set(collectedWords.map(w => w.token.text.toLowerCase()))
  const map: VisibilityMap = {}

  for (const token of article.tokens) {
    if (token.type !== 'word') {
      map[token.id] = 'revealed'
    } else if (revealedTokenIds.has(token.id) || collectedTexts.has(token.text.toLowerCase())) {
      map[token.id] = 'revealed'
    } else {
      map[token.id] = 'hidden'
    }
  }

  return map
}
