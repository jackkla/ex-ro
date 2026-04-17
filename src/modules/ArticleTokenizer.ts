import type { Token, TokenizedArticle, ArticleTitle, TokenType, Formatting } from '../types'

function getFormatting(node: Node): Formatting {
  let el = node.parentElement
  let isBold = false
  let isItalic = false
  let headingLevel: number | null = null
  let isSup = false
  let isSub = false

  while (el) {
    const tag = el.tagName.toLowerCase()
    if ((tag === 'b' || tag === 'strong') && !isBold) isBold = true
    if ((tag === 'i' || tag === 'em') && !isItalic) isItalic = true
    if (tag === 'h1' && headingLevel === null) headingLevel = 1
    if (tag === 'h2' && headingLevel === null) headingLevel = 2
    if (tag === 'h3' && headingLevel === null) headingLevel = 3
    if (tag === 'sup') isSup = true
    if (tag === 'sub') isSub = true
    el = el.parentElement
  }

  if (headingLevel === 1) return 'heading-1'
  if (headingLevel === 2) return 'heading-2'
  if (headingLevel === 3) return 'heading-3'
  if (isSup) return 'superscript'
  if (isSub) return 'subscript'
  if (isBold && isItalic) return 'bold-italic'
  if (isBold) return 'bold'
  if (isItalic) return 'italic'
  return 'plain'
}

function getWikilinkInfo(node: Node): { isWikilink: boolean; wikilinkTarget?: string } {
  let el = node.parentElement
  while (el) {
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') ?? ''
      const isWikiClass = el.classList.contains('wikilink')
      const wikiMatch = href.match(/^\/wiki\/([^:#]+)$/)
      if (isWikiClass || wikiMatch) {
        const raw = wikiMatch ? wikiMatch[1] : href.replace(/^\/wiki\//, '')
        const wikilinkTarget = decodeURIComponent(raw).replace(/_/g, ' ')
        return { isWikilink: true, wikilinkTarget }
      }
    }
    el = el.parentElement
  }
  return { isWikilink: false }
}

function getParagraphIndex(node: Node, allParagraphs: Element[]): number {
  let el = node.parentElement
  while (el) {
    if (el.tagName.toLowerCase() === 'p') {
      const idx = allParagraphs.indexOf(el)
      return idx >= 0 ? idx : -1
    }
    el = el.parentElement
  }
  return -1
}

function shouldSkipElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag === 'script' || tag === 'style') return true
  if (el.classList.contains('infobox')) return true
  if (el.classList.contains('navbox')) return true
  if (el.classList.contains('reflist')) return true
  if (el.classList.contains('references')) return true
  // citation superscripts
  if (tag === 'sup' && (el.classList.contains('reference') || el.classList.contains('cite'))) return true
  return false
}

export function tokenize(html: string, title: ArticleTitle): TokenizedArticle {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll('script, style, .infobox, .navbox, .reflist, .references, sup.reference, sup.cite')
    .forEach(el => el.remove())

  const allParagraphs = Array.from(doc.querySelectorAll('p'))
  const tokens: Token[] = []
  let tokenIndex = 0

  // Matches: newline, whitespace run, word, or single non-word non-space character
  const TOKEN_RE = /(\n|[ \t]+|\w+|[^\w\s])/g

  function processTextNode(node: Text): void {
    const text = node.textContent ?? ''
    if (!text) return

    const formatting = getFormatting(node)
    const { isWikilink, wikilinkTarget } = getWikilinkInfo(node)
    const paragraphIndex = getParagraphIndex(node, allParagraphs)

    TOKEN_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TOKEN_RE.exec(text)) !== null) {
      const t = match[0]
      let type: TokenType

      if (t === '\n') {
        type = 'newline'
      } else if (/^[ \t]+$/.test(t)) {
        type = 'space'
      } else if (/^\w+$/.test(t)) {
        type = 'word'
      } else {
        type = 'punct'
      }

      const id = `t_${String(tokenIndex).padStart(4, '0')}`
      tokenIndex++

      const token: Token = {
        id,
        text: t,
        type,
        formatting,
        paragraphIndex,
        isWikilink: type === 'word' && isWikilink,
        ...(type === 'word' && isWikilink && wikilinkTarget ? { wikilinkTarget } : {}),
      }
      tokens.push(token)
    }
  }

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node as Text)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as Element
    if (shouldSkipElement(el)) return

    for (const child of Array.from(el.childNodes)) {
      walk(child)
    }
  }

  const root = doc.querySelector('.mw-parser-output') ?? doc.body
  walk(root)

  return { title, tokens, frozenAt: Date.now() }
}
