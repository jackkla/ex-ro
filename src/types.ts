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
  svgPath: string
  naturalWidth: number
  naturalHeight: number
  area: number
}

export type TravelHistory = Record<string, number>
