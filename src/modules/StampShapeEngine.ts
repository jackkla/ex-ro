import type { StampShape } from '../types'
import { SCRABBLE_VALUES } from '../utils'

export type StampShapeEngineConfig = {
  anthropicApiKey?: string
}

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

function computeFinalScale(word: string): number {
  const score = word.toUpperCase().split('').reduce((sum, ch) => sum + (SCRABBLE_VALUES[ch] ?? 1), 0)
  return Math.min(2.5, 0.6 + score * 0.05)
}

function createSilhouette(emoji: string): { dataURL: string; bitmask: Uint8Array; size: number } {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, size, size)
  ctx.font = `${size * 0.75}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.05)

  const imgData = ctx.getImageData(0, 0, size, size)
  const data = imgData.data
  const bitmask = new Uint8Array(size * size)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 40) {
      bitmask[i / 4] = 1
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255
    } else {
      data[i + 3] = 0
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return { dataURL: canvas.toDataURL('image/png'), bitmask, size }
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
        content: `Given the word '${word}', return the single most visually iconic emoji that represents its shape or meaning. If abstract or no clear visual shape, return REJECT. Respond with only the emoji or REJECT.`,
      }],
    }),
  })
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  const data = await response.json() as { content: Array<{ text: string }> }
  return data.content[0].text.trim()
}

export function createStampShapeEngine(config: StampShapeEngineConfig = {}): {
  getShape: (word: string) => Promise<StampShape>
} {
  const emojiCache = new Map<string, string>()
  const shapeCache = new Map<string, StampShape>()

  async function resolveEmoji(word: string): Promise<string> {
    const lower = word.toLowerCase()
    if (emojiCache.has(lower)) return emojiCache.get(lower)!

    let emoji: string | undefined = WORD_EMOJI_FALLBACK[lower]

    if (!emoji && config.anthropicApiKey) {
      try {
        const result = await routeEmojiViaAI(lower, config.anthropicApiKey)
        if (result !== 'REJECT') emoji = result
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
      const { dataURL, bitmask, size } = createSilhouette(emoji)
      const finalScale = computeFinalScale(lower)

      const shape: StampShape = { word: lower, emoji, dataURL, bitmask, size, finalScale }
      shapeCache.set(lower, shape)
      return shape
    },
  }
}
