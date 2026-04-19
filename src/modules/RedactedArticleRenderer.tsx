import React, { useEffect, useRef } from 'react'
import type { TokenizedArticle, VisibilityMap, BoundingBoxMap, TokenId, Token, Formatting } from '../types'

export type RendererProps = {
  article: TokenizedArticle
  visibilityMap: VisibilityMap
  onBoundingBoxes: (map: BoundingBoxMap) => void
}

function formattingStyle(f: Formatting): React.CSSProperties {
  switch (f) {
    case 'bold': return { fontWeight: 'bold' }
    case 'italic': return { fontStyle: 'italic' }
    case 'bold-italic': return { fontWeight: 'bold', fontStyle: 'italic' }
    case 'heading-1': return { fontSize: '1.95em', fontWeight: 'normal', fontFamily: "'Linux Libertine', Georgia, Times, serif" }
    case 'heading-2': return { fontSize: '1.5em', fontWeight: 'normal', fontFamily: "'Linux Libertine', Georgia, Times, serif" }
    case 'heading-3': return { fontSize: '1.17em', fontWeight: 'bold' }
    case 'superscript': return { verticalAlign: 'super', fontSize: '0.75em' }
    case 'subscript': return { verticalAlign: 'sub', fontSize: '0.75em' }
    case 'wikilink': return { color: '#3366CC', textDecoration: 'none' }
    default: return {}
  }
}

// Every word is always rendered as real text; a redact bar sits on top
// and disappears (opacity → 0) once the word has been collected/revealed.
function WordToken({ token, revealed, refCallback }: {
  token: Token
  revealed: boolean
  refCallback: (el: HTMLElement | null) => void
}) {
  const textStyle: React.CSSProperties = {
    color: '#202122',
    ...formattingStyle(token.formatting),
  }

  return (
    <span
      ref={refCallback}
      data-token-id={token.id}
      style={{ position: 'relative', display: 'inline' }}
    >
      <span style={textStyle}>{token.text}</span>
      {/* Redact bar: covers word until collected via stamp */}
      <span
        style={{
          position: 'absolute',
          inset: '-1px -1px -1px -1px',
          background: token.isWikilink ? '#1a2a50' : '#1a1a1a',
          border: `1px solid ${token.isWikilink ? '#2a3a70' : '#2d2d2d'}`,
          borderRadius: '3px',
          pointerEvents: 'none',
          transition: 'opacity 0.14s ease-in',
          opacity: revealed ? 0 : 1,
        }}
      />
    </span>
  )
}

export function RedactedArticle({ article, visibilityMap, onBoundingBoxes }: RendererProps) {
  const tokenElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const onBoundingBoxesRef = useRef(onBoundingBoxes)
  useEffect(() => { onBoundingBoxesRef.current = onBoundingBoxes })

  // Report bounding boxes after every render
  useEffect(() => {
    const map: BoundingBoxMap = {}
    for (const [id, el] of tokenElsRef.current.entries()) {
      map[id] = el.getBoundingClientRect()
    }
    onBoundingBoxesRef.current(map)
  })

  function refCallback(id: string) {
    return (el: HTMLElement | null) => {
      if (el) tokenElsRef.current.set(id, el)
      else tokenElsRef.current.delete(id)
    }
  }

  type Group = { paraIdx: number; tokens: Token[] }
  const groups: Group[] = []
  for (const token of article.tokens) {
    const last = groups[groups.length - 1]
    if (!last || last.paraIdx !== token.paragraphIndex) {
      groups.push({ paraIdx: token.paragraphIndex, tokens: [token] })
    } else {
      last.tokens.push(token)
    }
  }

  function renderToken(token: Token): React.ReactNode {
    if (token.type === 'newline') return <br key={token.id} />
    if (token.type === 'space') return <span key={token.id}>{token.text}</span>
    if (token.type === 'punct') return <span key={token.id} style={{ color: '#202122' }}>{token.text}</span>

    const revealed = (visibilityMap[token.id] ?? 'hidden') !== 'hidden'
    return (
      <WordToken
        key={token.id}
        token={token}
        revealed={revealed}
        refCallback={refCallback(token.id)}
      />
    )
  }

  const headingBorderStyle: React.CSSProperties = {
    borderBottom: '1px solid #a2a9b1',
    paddingBottom: '3px',
    marginBottom: '0.25em',
  }

  return (
    <div style={{
      fontFamily: "'Linux Libertine', Georgia, Times, 'Times New Roman', serif",
      fontSize: '0.9375em',
      lineHeight: 1.6,
      color: '#202122',
      maxWidth: '960px',
    }}>
      {groups.map((group, gi) => {
        const content = group.tokens.map(renderToken)
        if (group.paraIdx >= 0) {
          return <p key={gi} style={{ margin: '0.5em 0', lineHeight: 1.6 }}>{content}</p>
        }
        const headingFmt = group.tokens.find(t => t.formatting?.startsWith('heading'))?.formatting
        const Tag = headingFmt === 'heading-1' ? 'h1' : headingFmt === 'heading-2' ? 'h2' : headingFmt === 'heading-3' ? 'h3' : 'div'
        const isH1orH2 = Tag === 'h1' || Tag === 'h2'
        return (
          <Tag key={gi} style={{
            margin: '1em 0 0',
            color: '#202122',
            fontWeight: Tag === 'h3' ? 'bold' : 'normal',
            ...(isH1orH2 ? headingBorderStyle : {}),
          }}>
            {content}
          </Tag>
        )
      })}
    </div>
  )
}
