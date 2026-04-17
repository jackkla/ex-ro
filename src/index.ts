// Shared types
export type {
  TokenId, UserId, ArticleTitle,
  Formatting, TokenType, Token,
  TokenizedArticle,
  VisibilityState, VisibilityMap,
  BoundingBoxMap,
  Formatting_Letter, LetterPool,
  CollectedWord, CraftHistory,
  StampShape, TravelHistory,
} from './types'

// Module 1 — ArticleTokenizer
export { tokenize } from './modules/ArticleTokenizer'

// Module 2 — ArticleFossilizer
export { fossilize } from './modules/ArticleFossilizer'

// Module 3 — RedactedArticleRenderer
export { RedactedArticle } from './modules/RedactedArticleRenderer'
export type { RendererProps } from './modules/RedactedArticleRenderer'

// Module 4 — StampShapeEngine
export { createStampShapeEngine } from './modules/StampShapeEngine'
export type { StampShapeEngineConfig } from './modules/StampShapeEngine'

// Module 5 — StampCursorAnimator
export { StampCursor } from './modules/StampCursorAnimator'
export type { CursorAnimatorProps } from './modules/StampCursorAnimator'

// Module 6 — HitDetector
export { detectHits } from './modules/HitDetector'

// Module 7 — InventoryManager
export { createInventoryManager } from './modules/InventoryManager'
export type { InventoryManager } from './modules/InventoryManager'

// Module 8 — StampCrafter
export { craft } from './modules/StampCrafter'
export type { CraftResult } from './modules/StampCrafter'

// Module 9 — VisibilityResolver
export { resolveVisibility } from './modules/VisibilityResolver'

// Module 10 — TravelManager
export { createTravelManager } from './modules/TravelManager'
export type { TravelManager, TravelResult } from './modules/TravelManager'
