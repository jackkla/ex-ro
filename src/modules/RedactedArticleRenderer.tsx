import React, { useEffect, useRef } from 'react'
import type { TokenizedArticle, VisibilityMap, BoundingBoxMap, TokenId, Token, Formatting } from '../types'

export type RendererProps = {
  article: TokenizedArticle
  visibilityMap: VisibilityMap
  onBoundingBoxes: (map: BoundingBoxMap) => void
  onWordClick?: (tokenId: TokenId) => void
}

function formattingStyle(f: Formatting): React.CSSProperties {
  switch (f) {
    case 'bold': return { fontWeight: 'bold' }
    case 'italic': return { fontStyle: 'italic' }
    case 'bold-italic': return { fontWeight: 'bold', fontStyle: 'italic' }
    case 'heading-1': return { fontSize: '2em', fontWeight: 'bold', display: 'block' }
    case 'heading-2': return { fontSize: '1.5em', fontWeight: 'bold', display: 'block' }
    case 'heading-3': return { fontSize: '1.17em', fontWeight: 'bold', display: 'block' }
    case 'superscript': return { verticalAlign: 'super', fontSize: '0.75em' }
    case 'subscript': return { verticalAlign: 'sub', fontSize: '0.75em' }
    case 'wikilink': return { textDecoration: 'underline', color: '#3366cc' }
    default: return {}
  }
}

function RedactBox({ token, visibility, onClick, refCallback }: {
  token: Token
  visibility: 'hidden' | 'dimmed'
  onClick?: () => void
  refCallback: (el: HTMLElement | null) => void
}) {
  const width = `${Math.max(token.text.length * 0.6, 0.5)}em`
  return (
    <span
      ref={refCallback}
      data-token-id={token.id}
      onClick={onClick}
      style={{
        display: 'inline-block',
        width,
        height: '0.9em',
        backgroundColor: '#1a1a1a',
        opacity: visibility === 'dimmed' ? 0.3 : 1,
        verticalAlign: 'middle',
        borderRadius: '2px',
        margin: '0 1px',
        cursor: onClick ? 'pointer' : undefined,
      }}
    />
  )
}

function RevealedToken({ token, onClick, refCallback }: {
  token: Token
  onClick?: () => void
  refCallback: (el: HTMLElement | null) => void
}) {
  const style: React.CSSProperties = {
    ...formattingStyle(token.formatting),
    ...(token.isWikilink ? { textDecoration: 'underline', color: '#3366cc', cursor: 'default' } : {}),
  }
  return (
    <span
      ref={refCallback}
      data-token-id={token.id}
      onClick={onClick}
      style={style}
    >
      {token.text}
    </span>
  )
}

export function RedactedArticle({ article, visibilityMap, onBoundingBoxes, onWordClick }: RendererProps) {
  const tokenElsRef = useRef<Map<string, HTMLElement>>(new Map())
  // Use a ref for onBoundingBoxes to avoid triggering the effect when the callback identity changes
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

  // Group tokens into consecutive runs sharing the same paragraphIndex
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
    if (token.type === 'punct') return <span key={token.id}>{token.text}</span>

    // word token
    const visibility = visibilityMap[token.id] ?? 'hidden'
    const handleClick = () => onWordClick?.(token.id)

    if (visibility === 'revealed') {
      return (
        <RevealedToken
          key={token.id}
          token={token}
          onClick={onWordClick ? handleClick : undefined}
          refCallback={refCallback(token.id)}
        />
      )
    }
    return (
      <RedactBox
        key={token.id}
        token={token}
        visibility={visibility}
        onClick={onWordClick ? handleClick : undefined}
        refCallback={refCallback(token.id)}
      />
    )
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', lineHeight: 1.7, padding: '1.5em', maxWidth: '65ch' }}>
      {groups.map((group, gi) => {
        const content = group.tokens.map(renderToken)
        if (group.paraIdx >= 0) {
          return <p key={gi} style={{ margin: '0.75em 0' }}>{content}</p>
        }
        return <div key={gi}>{content}</div>
      })}
    </div>
  )
}
