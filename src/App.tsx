import React, { useState, useCallback, useRef, useMemo } from 'react'
import { tokenize } from './modules/ArticleTokenizer'
import { RedactedArticle } from './modules/RedactedArticleRenderer'
import { resolveVisibility } from './modules/VisibilityResolver'
import { createInventoryManager } from './modules/InventoryManager'
import { craft } from './modules/StampCrafter'
import { createStampShapeEngine } from './modules/StampShapeEngine'
import { StampCursor } from './modules/StampCursorAnimator'
import { detectHits } from './modules/HitDetector'
import { createTravelManager } from './modules/TravelManager'
import type {
  TokenId, BoundingBoxMap, StampShape, CraftHistory,
  TravelHistory, CollectedWord, LetterPool,
} from './types'

type ElementMap = Map<TokenId, HTMLElement>
import './App.css'

const MOCK_HTML = `
<div class="mw-parser-output">
  <p><b>Saturn</b> is the sixth <a href="/wiki/planet" class="wikilink">planet</a> from the
  <a href="/wiki/Sun" class="wikilink">Sun</a> and the second-largest in the
  <a href="/wiki/Solar_System" class="wikilink">Solar System</a>, after
  <a href="/wiki/Jupiter" class="wikilink">Jupiter</a>. It is a
  <a href="/wiki/Gas_giant" class="wikilink">gas giant</a> with an average radius of about nine
  and a half times that of <a href="/wiki/Earth" class="wikilink">Earth</a>.</p>
  <p>Saturn has a prominent <a href="/wiki/Rings_of_Saturn" class="wikilink">ring system</a>
  that consists of nine continuous main rings, composed mostly of
  <a href="/wiki/Ice" class="wikilink">ice</a> particles, rocky debris, and dust. At least 146
  <a href="/wiki/Moons_of_Saturn" class="wikilink">moons</a> are known to orbit Saturn, of which
  63 are officially named. The largest moon, <a href="/wiki/Titan_(moon)" class="wikilink">Titan</a>,
  is bigger than the planet <a href="/wiki/Mercury_(planet)" class="wikilink">Mercury</a>.</p>
  <h2>Physical characteristics</h2>
  <p>Saturn is <i>oblate</i> — its equatorial and polar radii differ by almost 10%. It is the only
  <a href="/wiki/planet" class="wikilink">planet</a> in the Solar System less dense than
  <a href="/wiki/Water" class="wikilink">water</a>. Its rapid rotation and fluid interior produce
  powerful <a href="/wiki/Wind" class="wikilink">winds</a> and enormous storms.</p>
  <p>The <b>atmosphere</b> of Saturn is composed mostly of
  <a href="/wiki/Hydrogen" class="wikilink">hydrogen</a> and
  <a href="/wiki/Helium" class="wikilink">helium</a>, with traces of
  <a href="/wiki/Ammonia" class="wikilink">ammonia</a>, methane, and water ice crystals that give
  it a pale <a href="/wiki/Yellow" class="wikilink">yellow</a> hue.</p>
</div>`

const PIXELS_PER_AREA = 600

// Module instances — created once outside React tree
const inv = createInventoryManager(30)
const shapeEngine = createStampShapeEngine()
const travelMgr = createTravelManager()

export default function App() {
  const article = useMemo(() => tokenize(MOCK_HTML, 'Saturn'), [])

  const [words, setWords] = useState<CollectedWord[]>([])
  const [letterPool, setLetterPool] = useState<LetterPool>({})
  const [revealedIds, setRevealedIds] = useState<Set<TokenId>>(new Set())
  const [craftHistory, setCraftHistory] = useState<CraftHistory>({})
  const [travelHistory, setTravelHistory] = useState<TravelHistory>({ travel: 0 })

  const [craftWord, setCraftWord] = useState('')
  const [crafting, setCrafting] = useState(false)
  const [activeStamp, setActiveStamp] = useState<StampShape | null>(null)
  const [stampMode, setStampMode] = useState(false)
  const [hitIds, setHitIds] = useState<Set<TokenId>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const articleRef = useRef<HTMLDivElement>(null)
  const bbRef = useRef<ElementMap>(new Map())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibilityMap = useMemo(
    () => resolveVisibility(article, words, revealedIds),
    [article, words, revealedIds],
  )

  const availableLinks = useMemo(
    () => travelMgr.getAvailableLinks(words, revealedIds),
    [words, revealedIds],
  )

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  // Use a ref-callback so element ref updates never trigger App re-renders
  const handleElementRefs = useCallback((map: ElementMap) => {
    bbRef.current = map
  }, [])

  const handleWordClick = useCallback((tokenId: TokenId) => {
    const token = article.tokens.find(t => t.id === tokenId)
    if (!token || token.type !== 'word') return
    const result = inv.addWord(token)
    if (result.success) {
      setWords(inv.getWords())
      showToast(`+ "${token.text}"`)
    } else {
      showToast('Inventory full!')
    }
  }, [article, showToast])

  function handleReveal(wordId: string) {
    const word = words.find(w => w.id === wordId)
    if (!word) return
    setRevealedIds(prev => new Set([...prev, word.token.id]))
    showToast(`Revealed "${word.token.text}"`)
  }

  function handleScrap(wordId: string) {
    inv.scrapWord(wordId)
    setWords(inv.getWords())
    setLetterPool(inv.getLetterPool())
    showToast('Scrapped → letters added')
  }

  async function handleCraft() {
    const w = craftWord.trim().toLowerCase()
    if (!w) return
    setCrafting(true)
    try {
      const result = await craft(w, letterPool, craftHistory, shapeEngine.getShape)
      if (result.success) {
        setLetterPool(result.updatedLetterPool)
        setCraftHistory(result.updatedHistory)
        setActiveStamp(result.stamp)
        setStampMode(true)
        setCraftWord('')
        showToast(`${result.stamp.emoji} "${result.stamp.word}" stamp crafted!`)
      } else {
        const missing = Object.entries(result.shortfall)
          .map(([c, n]) => `${n}×${c}`).join(' ')
        showToast(`Need: ${missing}`)
      }
    } finally {
      setCrafting(false)
    }
  }

  const handleStampMouseMove = useCallback((x: number, y: number) => {
    if (!activeStamp || !articleRef.current) return
    const cRect = articleRef.current.getBoundingClientRect()
    // Compute fresh DOMRects from element refs to avoid stale positions during scroll
    const freshBBMap: BoundingBoxMap = {}
    for (const [id, el] of bbRef.current.entries()) {
      freshBBMap[id] = el.getBoundingClientRect()
    }
    const hits = detectHits(activeStamp, x, y, PIXELS_PER_AREA, freshBBMap, cRect)
    // Only highlight words not yet collected (hidden), preventing overlap with prior stamps
    setHitIds(new Set(hits.filter(id => (visibilityMap[id] ?? 'hidden') === 'hidden')))
  }, [activeStamp, visibilityMap])

  function handleArticleClick() {
    if (!stampMode || hitIds.size === 0) return
    let collected = 0
    for (const tokenId of hitIds) {
      const token = article.tokens.find(t => t.id === tokenId)
      if (token && token.type === 'word') {
        if (inv.addWord(token).success) collected++
      }
    }
    if (collected > 0) {
      setWords(inv.getWords())
      showToast(`+ ${collected} word${collected > 1 ? 's' : ''} collected!`)
    }
    // Stamps are single-use: consume after stamping
    setHitIds(new Set())
    setActiveStamp(null)
    setStampMode(false)
  }

  function handleTravel(word: CollectedWord) {
    const cost = travelMgr.getTravelCost('travel', travelHistory)
    const result = travelMgr.travel(word.token, 'travel', letterPool, travelHistory)
    if (result.success) {
      setLetterPool(result.updatedLetterPool)
      setTravelHistory(result.updatedHistory)
      showToast(`→ ${result.destination}`)
    } else if (result.reason === 'insufficient_letters') {
      showToast(`Need ${cost}× each letter of "travel"`)
    } else {
      showToast(`Cannot travel: ${result.reason}`)
    }
  }

  const cap = inv.getCapacity()
  const letterEntries = Object.entries(letterPool).sort(([a], [b]) => a.localeCompare(b))
  const travelCost = travelMgr.getTravelCost('travel', travelHistory)
  const canTravel = travelMgr.canAfford('travel', letterPool, travelHistory)

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">EX<span className="logo-dot">✦</span>RO</span>
        <span className="header-title">Saturn — Wikipedia</span>
        <span className="header-hint">click black boxes to collect · scrap words for letters · craft stamps</span>
        {activeStamp && (
          <button
            className={`stamp-btn ${stampMode ? 'active' : ''}`}
            onClick={() => { setStampMode(m => !m); setHitIds(new Set()) }}
          >
            {activeStamp.emoji}
            <span className="stamp-word">{activeStamp.word}</span>
            <span className="stamp-state">{stampMode ? 'stamping' : 'paused'}</span>
          </button>
        )}
      </header>

      {toast && <div className="toast">{toast}</div>}

      <div className="layout">
        <main
          className={`article-panel${stampMode ? ' stamp-mode' : ''}`}
          ref={articleRef}
          onClick={handleArticleClick}
        >
          <RedactedArticle
            article={article}
            visibilityMap={visibilityMap}
            onElementRefs={handleElementRefs}
            onWordClick={stampMode ? undefined : handleWordClick}
          />

          {/* Gold highlights for words under the stamp — compute fresh DOMRects to avoid scroll lag */}
          {stampMode && activeStamp && Array.from(hitIds).map(id => {
            const el = bbRef.current.get(id)
            if (!el) return null
            const rect = el.getBoundingClientRect()
            return (
              <div
                key={id}
                className="hit-highlight"
                style={{
                  position: 'fixed',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height + 4,
                }}
              />
            )
          })}

          {activeStamp && stampMode && (
            <StampCursor
              shape={activeStamp}
              containerRef={articleRef as React.RefObject<HTMLElement>}
              pixelsPerAreaUnit={PIXELS_PER_AREA}
              onMouseMove={handleStampMouseMove}
            />
          )}
        </main>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-title">
              Inventory
              <span className="pill">{cap.used}/{cap.max}</span>
            </div>
            {words.length === 0
              ? <p className="hint">Click any ▮▮▮ in the article to collect it</p>
              : (
                <ul className="word-list">
                  {words.map(w => (
                    <li key={w.id} className={`word-item fmt-${w.token.formatting}`}>
                      <span className="word-text">{w.token.text}</span>
                      {w.token.isWikilink && <span className="wiki-badge">↗</span>}
                      <div className="word-btns">
                        <button className="btn-sm btn-reveal" onClick={() => handleReveal(w.id)}>reveal</button>
                        <button className="btn-sm btn-scrap" onClick={() => handleScrap(w.id)}>scrap</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            }
          </section>

          {letterEntries.length > 0 && (
            <section className="panel">
              <div className="panel-title">Letters</div>
              <div className="tile-grid">
                {letterEntries.map(([char, tiles]) =>
                  tiles.map((tile, i) => (
                    <span key={`${char}-${i}`} className={`tile fmt-${tile.formatting}`} title={`${tile.scrabbleValue} pts`}>
                      {char}<sup>{tile.scrabbleValue}</sup>
                    </span>
                  ))
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-title">Craft a stamp</div>
            <div className="craft-row">
              <input
                className="craft-input"
                value={craftWord}
                onChange={e => setCraftWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !crafting && handleCraft()}
                placeholder="spell a word…"
                disabled={crafting}
                spellCheck={false}
              />
              <button
                className="btn-craft"
                onClick={handleCraft}
                disabled={crafting || !craftWord.trim()}
              >
                {crafting ? '…' : 'Craft'}
              </button>
            </div>
            {Object.entries(craftHistory).length > 0 && (
              <div className="history-chips">
                {Object.entries(craftHistory).map(([w, n]) => (
                  <span key={w} className="chip">{w} ×{n}</span>
                ))}
              </div>
            )}
          </section>

          {availableLinks.length > 0 && (
            <section className="panel">
              <div className="panel-title">
                Travel
                {!canTravel && <span className="travel-note">need {travelCost}× each of T-R-A-V-E-L</span>}
              </div>
              <ul className="link-list">
                {availableLinks.map(w => (
                  <li key={w.id}>
                    <button
                      className="btn-travel"
                      onClick={() => handleTravel(w)}
                      disabled={!canTravel}
                    >
                      {w.token.wikilinkTarget ?? w.token.text}
                      <span className="link-arrow">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
