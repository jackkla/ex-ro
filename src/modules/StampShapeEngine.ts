import type { StampShape } from '../types'
import { SCRABBLE_VALUES } from '../utils'

export type StampShapeEngineConfig = {
  anthropicApiKey?: string
}

// Simple fallback: common words → emoji
const WORD_EMOJI_FALLBACK: Record<string, string> = {
  star: '⭐', sun: '☀️', moon: '🌙', heart: '❤️', fire: '🔥',
  tree: '🌳', flower: '🌸', cloud: '☁️', wave: '🌊', mountain: '⛰️',
  book: '📖', key: '🔑', eye: '👁️', hand: '✋', crown: '👑',
  sword: '⚔️', shield: '🛡️', arrow: '➡️', circle: '⭕', diamond: '💎',
  fish: '🐟', bird: '🐦', snake: '🐍', cat: '🐱', dog: '🐶',
  house: '🏠', car: '🚗', boat: '⛵', plane: '✈️', rocket: '🚀',
  apple: '🍎', leaf: '🍃', rose: '🌹', drop: '💧', bolt: '⚡',
  world: '🌍', earth: '🌎', globe: '🌐', ring: '💍', bell: '🔔',
  flag: '🚩', pin: '📌', map: '🗺️', compass: '🧭', clock: '🕐',
  crystal: '🔮', gem: '💎', skull: '💀', ghost: '👻', alien: '👾',
}

function computeArea(word: string): number {
  return word.toUpperCase().split('').reduce((sum, ch) => sum + (SCRABBLE_VALUES[ch] ?? 0), 0)
}

// Returns Twemoji CDN codepoint string for an emoji character
function emojiToCDNCode(emoji: string): string {
  const codepoints: string[] = []
  for (const char of emoji) {
    const cp = char.codePointAt(0)
    if (cp === undefined || cp === 0xfe0f || cp === 0x200d) continue
    codepoints.push(cp.toString(16).toLowerCase())
  }
  return codepoints.join('-')
}

async function fetchTwemojiPath(emoji: string): Promise<{ path: string; naturalWidth: number; naturalHeight: number } | null> {
  const code = emojiToCDNCode(emoji)
  if (!code) return null

  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const svgText = await res.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgText, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    if (!svgEl) return null

    const vb = (svgEl.getAttribute('viewBox') ?? '0 0 36 36').split(/\s+/).map(Number)
    const [vbX, vbY, vbW, vbH] = vb.length === 4 ? vb : [0, 0, 36, 36]
    const naturalWidth = vbW - vbX
    const naturalHeight = vbH - vbY

    const pathData = Array.from(doc.querySelectorAll('path, circle, rect, polygon, ellipse'))
      .map(el => {
        const tag = el.tagName.toLowerCase()
        if (tag === 'path') return el.getAttribute('d') ?? ''
        if (tag === 'circle') {
          const cx = el.getAttribute('cx') ?? '0'
          const cy = el.getAttribute('cy') ?? '0'
          const r = el.getAttribute('r') ?? '0'
          // Approximate circle as SVG path
          return `M ${cx} ${parseFloat(cy) - parseFloat(r)} A ${r} ${r} 0 1 0 ${cx} ${parseFloat(cy) + parseFloat(r)} A ${r} ${r} 0 1 0 ${cx} ${parseFloat(cy) - parseFloat(r)} Z`
        }
        return ''
      })
      .filter(Boolean)
      .join(' ')

    if (!pathData) return null
    return { path: pathData, naturalWidth, naturalHeight }
  } catch {
    return null
  }
}

// Fallback geometric SVG paths (normalized to ~36×36 viewBox)
function getFallbackShape(emoji: string): { path: string; naturalWidth: number; naturalHeight: number } {
  // 5-pointed star in 36×36 space
  void emoji
  const points: [number, number][] = []
  const cx = 18, cy = 18, outerR = 16, innerR = 7
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z'
  return { path, naturalWidth: 36, naturalHeight: 36 }
}

async function routeEmojiViaAI(word: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{
        role: 'user',
        content: `Given the word '${word}', return the single most visually iconic emoji that represents its shape or meaning. Respond with only the emoji.`,
      }],
    }),
  })
  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
  const data = await response.json() as { content: Array<{ text: string }> }
  return data.content[0].text.trim()
}

export function createStampShapeEngine(config: StampShapeEngineConfig = {}): {
  getShape: (word: string) => Promise<StampShape>
} {
  // Session-scoped caches
  const emojiCache = new Map<string, string>()
  const shapeCache = new Map<string, StampShape>()

  async function resolveEmoji(word: string): Promise<string> {
    const lower = word.toLowerCase()
    if (emojiCache.has(lower)) return emojiCache.get(lower)!

    let emoji: string | undefined = WORD_EMOJI_FALLBACK[lower]

    if (!emoji && config.anthropicApiKey) {
      try {
        emoji = await routeEmojiViaAI(lower, config.anthropicApiKey)
      } catch {
        // fall through to default
      }
    }

    emoji ??= '⭐'
    emojiCache.set(lower, emoji)
    return emoji
  }

  return {
    async getShape(word: string): Promise<StampShape> {
      const lower = word.toLowerCase()
      if (shapeCache.has(lower)) return shapeCache.get(lower)!

      const emoji = await resolveEmoji(lower)
      const area = computeArea(lower)

      const svgData = await fetchTwemojiPath(emoji) ?? getFallbackShape(emoji)

      const shape: StampShape = {
        word: lower,
        emoji,
        svgPath: svgData.path,
        naturalWidth: svgData.naturalWidth,
        naturalHeight: svgData.naturalHeight,
        area,
      }

      shapeCache.set(lower, shape)
      return shape
    },
  }
}
