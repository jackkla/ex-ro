import type { TokenizedArticle, UserId, ArticleTitle } from '../types'

const CACHE_KEY_PREFIX = 'exro:fossil:'
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php'

function cacheKey(userId: UserId, title: ArticleTitle): string {
  return `${CACHE_KEY_PREFIX}${userId}:${title}`
}

function readFromCache(key: string): TokenizedArticle | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as TokenizedArticle
  } catch {
    return null
  }
}

function writeToCache(key: string, article: TokenizedArticle): void {
  try {
    // Write-once: only store if not already present
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify(article))
    }
  } catch {
    // Storage quota exceeded or unavailable — silently skip
  }
}

export async function fossilize(
  userId: UserId,
  title: ArticleTitle,
  tokenize: (html: string, title: ArticleTitle) => TokenizedArticle,
): Promise<TokenizedArticle> {
  const key = cacheKey(userId, title)

  const cached = readFromCache(key)
  if (cached) return cached

  const url = new URL(WIKIPEDIA_API)
  url.searchParams.set('action', 'parse')
  url.searchParams.set('page', title)
  url.searchParams.set('prop', 'text')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Wikipedia API error ${response.status} for article: ${title}`)
  }

  const data = await response.json() as { parse?: { text?: { '*'?: string } } }
  const html = data?.parse?.text?.['*']
  if (!html) {
    throw new Error(`No HTML content returned for article: ${title}`)
  }

  const article = tokenize(html, title)
  writeToCache(key, article)
  return article
}
