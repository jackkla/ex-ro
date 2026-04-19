import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { tokenize } from './modules/ArticleTokenizer'
import { RedactedArticle } from './modules/RedactedArticleRenderer'
import { resolveVisibility } from './modules/VisibilityResolver'
import { createInventoryManager } from './modules/InventoryManager'
import { craft } from './modules/StampCrafter'
import { createStampShapeEngine } from './modules/StampShapeEngine'
import { detectHits } from './modules/HitDetector'
import { createTravelManager } from './modules/TravelManager'
import type {
  TokenId, BoundingBoxMap, StampShape, PlacedStamp, CraftHistory,
  TravelHistory, CollectedWord, LetterPool,
} from './types'
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

const inv = createInventoryManager(30)
const shapeEngine = createStampShapeEngine()
const travelMgr = createTravelManager()

export default function App() {
  const article = useMemo(() => tokenize(MOCK_HTML, 'Saturn'), [])

  const [words, setWords]               = useState<CollectedWord[]>([])
  const [letterPool, setLetterPool]     = useState<LetterPool>({})
  const [revealedIds]                   = useState<Set<TokenId>>(new Set())
  const [craftHistory, setCraftHistory] = useState<CraftHistory>({})
  const [travelHistory, setTravelHistory] = useState<TravelHistory>({ travel: 0 })

  const [craftWord, setCraftWord] = useState('')
  const [crafting, setCrafting]   = useState(false)
  const [activeStamp, setActiveStamp]   = useState<StampShape | null>(null)
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([])
  const [overlayH, setOverlayH]         = useState(600)
  const [toast, setToast]               = useState<string | null>(null)

  const articleRef = useRef<HTMLDivElement>(null)
  const bbRef      = useRef<BoundingBoxMap>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // RAF / cursor refs — direct DOM mutation, no re-renders per frame
  const rotRef          = useRef(0)
  const rafRef          = useRef<number | undefined>(undefined)
  const mouseViewRef    = useRef({ x: -9999, y: -9999 })
  const mouseContentRef = useRef({ x: -9999, y: -9999 })
  const cursorHoleRef   = useRef<SVGGElement>(null)
  const cursorImgRef    = useRef<SVGGElement>(null)

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

  const handleBoundingBoxes = useCallback((map: BoundingBoxMap) => {
    bbRef.current = map
  }, [])

  // Track overlay height so the absolute SVG always covers full scroll content
  useEffect(() => {
    const panel = articleRef.current
    if (!panel) return
    const obs = new ResizeObserver(() => setOverlayH(panel.scrollHeight))
    obs.observe(panel)
    setOverlayH(panel.scrollHeight)
    return () => obs.disconnect()
  }, [])

  // RAF loop: advances rotation + updates cursor DOM nodes directly (no re-render)
  useEffect(() => {
    if (!activeStamp) {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
      if (cursorImgRef.current)  cursorImgRef.current.style.display  = 'none'
      if (cursorHoleRef.current) cursorHoleRef.current.style.display = 'none'
      return
    }

    const { finalScale, size } = activeStamp

    const tick = () => {
      rotRef.current = (rotRef.current + 0.013) % (Math.PI * 2)
      const rot = (rotRef.current * 180) / Math.PI
      const { x: vx, y: vy } = mouseViewRef.current
      const { x: cx, y: cy } = mouseContentRef.current
      const offscreen = vx < -900

      if (cursorImgRef.current) {
        cursorImgRef.current.style.display = offscreen ? 'none' : 'block'
        if (!offscreen) {
          cursorImgRef.current.setAttribute(
            'transform',
            `translate(${vx}, ${vy}) rotate(${rot}) scale(${finalScale})`,
          )
        }
      }
      if (cursorHoleRef.current) {
        cursorHoleRef.current.style.display = offscreen ? 'none' : 'block'
        if (!offscreen) {
          cursorHoleRef.current.setAttribute(
            'transform',
            `translate(${cx}, ${cy}) rotate(${rot}) scale(${finalScale})`,
          )
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current) }
  }, [activeStamp])

  // Mouse tracking for stamp cursor (content + viewport coords)
  useEffect(() => {
    if (!activeStamp) return
    const panel = articleRef.current
    if (!panel) return

    const onMove = (e: MouseEvent) => {
      mouseViewRef.current = { x: e.clientX, y: e.clientY }
      const rect = panel.getBoundingClientRect()
      mouseContentRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top + panel.scrollTop,
      }
    }
    const onLeave = () => {
      mouseViewRef.current    = { x: -9999, y: -9999 }
      mouseContentRef.current = { x: -9999, y: -9999 }
    }

    panel.addEventListener('mousemove', onMove)
    panel.addEventListener('mouseleave', onLeave)
    return () => {
      panel.removeEventListener('mousemove', onMove)
      panel.removeEventListener('mouseleave', onLeave)
      mouseViewRef.current    = { x: -9999, y: -9999 }
      mouseContentRef.current = { x: -9999, y: -9999 }
    }
  }, [activeStamp])

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
        setCraftWord('')
        showToast(`${result.stamp.emoji} "${result.stamp.word}" stamp ready!`)
      } else {
        const missing = Object.entries(result.shortfall)
          .map(([c, n]) => `${n}×${c}`).join(' ')
        showToast(`Need: ${missing}`)
      }
    } finally {
      setCrafting(false)
    }
  }

  function handleArticleClick(e: React.MouseEvent<HTMLElement>) {
    if (!activeStamp || !articleRef.current) return

    const panel = articleRef.current
    const rect  = panel.getBoundingClientRect()
    const contentX = e.clientX - rect.left
    const contentY = e.clientY - rect.top + panel.scrollTop

    const newStamp: PlacedStamp = {
      id: `s${Date.now()}`,
      cx: contentX,
      cy: contentY,
      angle: rotRef.current,
      shapeDef: activeStamp,
    }

    setPlacedStamps(prev => [...prev, newStamp])

    const hits      = detectHits(newStamp, bbRef.current, rect, panel.scrollTop)
    const toCollect = hits.filter(id => visibilityMap[id] !== 'revealed')

    let collected = 0
    for (const tokenId of toCollect) {
      const token = article.tokens.find(t => t.id === tokenId)
      if (token?.type === 'word' && inv.addWord(token).success) collected++
    }
    if (collected > 0) {
      setWords(inv.getWords())
      showToast(`+ ${collected} word${collected > 1 ? 's' : ''} collected!`)
    }
  }

  function handleScrap(wordId: string) {
    inv.scrapWord(wordId)
    setWords(inv.getWords())
    setLetterPool(inv.getLetterPool())
    showToast('Scrapped → letters added')
  }

  function handleTravel(word: CollectedWord) {
    const cost   = travelMgr.getTravelCost('travel', travelHistory)
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

  const cap          = inv.getCapacity()
  const letterEntries = Object.entries(letterPool).sort(([a], [b]) => a.localeCompare(b))
  const travelCost   = travelMgr.getTravelCost('travel', travelHistory)
  const canTravel    = travelMgr.canAfford('travel', letterPool, travelHistory)

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">EX<span className="logo-dot">✦</span>RO</span>
        <span className="header-title">Saturn — Wikipedia</span>
        <span className="header-hint">craft a stamp · stamp the article to collect words</span>
        {activeStamp && (
          <span className="active-stamp-badge">
            {activeStamp.emoji} <span className="stamp-word">{activeStamp.word}</span>
          </span>
        )}
      </header>

      {toast && <div className="toast">{toast}</div>}

      <div className="layout">
        {/* Article: always covered by black overlay; stamps cut holes to reveal + collect */}
        <main
          className={`article-panel${activeStamp ? ' stamp-mode' : ''}`}
          ref={articleRef}
          onClick={handleArticleClick}
        >
          <RedactedArticle
            article={article}
            visibilityMap={visibilityMap}
            onBoundingBoxes={handleBoundingBoxes}
          />

          {/* Dark SVG overlay — always present; stamp images punch holes in the mask */}
          <svg
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%',
              height: overlayH,
              pointerEvents: 'none',
              zIndex: 10,
              overflow: 'visible',
            }}
          >
            <defs>
              <mask id="stamp-mask">
                <rect width="100%" height={overlayH} fill="white" />
                {placedStamps.map(s => (
                  <g
                    key={s.id}
                    transform={`translate(${s.cx}, ${s.cy}) rotate(${(s.angle * 180) / Math.PI}) scale(${s.shapeDef.finalScale})`}
                  >
                    <image
                      href={s.shapeDef.dataURL}
                      x={-s.shapeDef.size / 2}
                      y={-s.shapeDef.size / 2}
                      width={s.shapeDef.size}
                      height={s.shapeDef.size}
                    />
                  </g>
                ))}
                {/* Live cursor preview hole — transform updated each RAF tick via ref */}
                <g ref={cursorHoleRef} style={{ display: 'none' }}>
                  {activeStamp && (
                    <image
                      href={activeStamp.dataURL}
                      x={-activeStamp.size / 2}
                      y={-activeStamp.size / 2}
                      width={activeStamp.size}
                      height={activeStamp.size}
                    />
                  )}
                </g>
              </mask>
            </defs>
            <rect
              width="100%"
              height={overlayH}
              fill="rgba(0,0,0,0.93)"
              mask="url(#stamp-mask)"
            />
          </svg>
        </main>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-title">
              Inventory
              <span className="pill">{cap.used}/{cap.max}</span>
            </div>
            {words.length === 0
              ? <p className="hint">Craft a stamp below, then stamp the article to collect words</p>
              : (
                <ul className="word-list">
                  {words.map(w => (
                    <li key={w.id} className={`word-item fmt-${w.token.formatting}`}>
                      <span className="word-text">{w.token.text}</span>
                      {w.token.isWikilink && <span className="wiki-badge">↗</span>}
                      <button className="btn-sm btn-scrap" onClick={() => handleScrap(w.id)}>scrap</button>
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

      {/* Fixed cursor: rotating stamp image shown at mouse viewport position */}
      {activeStamp && (
        <svg
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100vw', height: '100vh',
            pointerEvents: 'none',
            zIndex: 50,
            overflow: 'visible',
          }}
        >
          <g ref={cursorImgRef} style={{ display: 'none', opacity: 0.4 }}>
            <image
              href={activeStamp.dataURL}
              x={-activeStamp.size / 2}
              y={-activeStamp.size / 2}
              width={activeStamp.size}
              height={activeStamp.size}
            />
          </g>
        </svg>
      )}
    </div>
  )
}
