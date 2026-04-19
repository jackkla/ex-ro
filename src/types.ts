export type TokenId = string
export type UserId = string
export type ArticleTitle = string

export type Formatting =
  | 'plain'
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'heading-1' | 'heading-2' | 'heading-3'
  | 'superscript'
  | 'subscript'
  | 'wikilink'

export type TokenType = 'word' | 'punct' | 'space' | 'newline'

export type Token = {
  id: TokenId
  text: string
  type: TokenType
  formatting: Formatting
  paragraphIndex: number
  isWikilink: boolean
  wikilinkTarget?: ArticleTitle
}

export type TokenizedArticle = {
  title: ArticleTitle
  tokens: Token[]
  frozenAt: number
}

export type VisibilityState = 'hidden' | 'dimmed' | 'revealed'
export type VisibilityMap = Record<TokenId, VisibilityState>

export type BoundingBoxMap = Record<TokenId, DOMRect>

export type Formatting_Letter = {
  char: string
  formatting: Formatting
  scrabbleValue: number
  formattingMultiplier: number
}

export type LetterPool = Record<string, Formatting_Letter[]>

export type CollectedWord = {
  id: string
  token: Token
  collectedAt: number
}

export type CraftHistory = Record<string, number>

export type StampShape = {
  word: string
  emoji: string
  dataURL: string      // canvas-rendered emoji silhouette as PNG data URL
  bitmask: Uint8Array  // 1 = inside silhouette, 0 = outside
  size: number         // canvas dimension (always 128)
  finalScale: number   // scrabble-score-based visual scale factor
}

export type PlacedStamp = {
  id: string
  cx: number       // content-space X (panel-relative, scroll-adjusted)
  cy: number       // content-space Y
  angle: number    // radians at time of placement
  shapeDef: StampShape
}

export type TravelHistory = Record<string, number>
