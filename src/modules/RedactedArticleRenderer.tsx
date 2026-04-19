import React, { useEffect, useRef } from 'react'
import type { TokenizedArticle, VisibilityMap, TokenId, Token, Formatting } from '../types'

export type RendererProps = {
  article: TokenizedArticle
  visibilityMap: VisibilityMap
  onElementRefs: (map: Map<TokenId, HTMLElement>) => void
  onWordClick?: (tokenId: TokenId) => void
}

function formattingStyle(f: Formatting): React.CSSProperties {
  switch (f) {
    case 'bold': return { fontWeight: 'bold' }
    case 'italic': return { fontStyle: 'italic' }
    case 'bold-italic': return { fontWeight: 'bold', fontStyle: 'italic' }
    case 'heading-1': return { fontSize: '2em', fontWeight: 'bold' }
    case 'heading-2': return { fontSize: '1.5em', fontWeight: 'bold' }
    case 'heading-3': return { fontSize: '1.17em', fontWeight: 'bold' }
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
        height: '0.75em',
        backgroundColor: '#333',
        opacity: visibility === 'dimmed' ? 0.25 : 1,
        verticalAlign: 'text-bottom',
        borderRadius: '2px',
        margin: '0 1px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'opacity 0.15s',
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

export function RedactedArticle({ article, visibilityMap, onElementRefs, onWordClick }: RendererProps) {
  const tokenElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const onElementRefsRef = useRef(onElementRefs)
  useEffect(() => { onElementRefsRef.current = onElementRefs })

  // Pass element refs to parent after every render so it can compute fresh DOMRects on demand
  useEffect(() => {
    onElementRefsRef.current(tokenElsRef.current)
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
    if (token.type === 'punct') return <span key={token.id}>{token.text}</span>

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
    <div style={{
      fontFamily: 'Georgia, "Linux Libertine", "Times New Roman", serif',
      lineHeight: 1.6,
      padding: '1.5em 2em',
      maxWidth: '960px',
      backgroundColor: '#fff',
      color: '#202122',
      fontSize: '14px',
      minHeight: '100%',
    }}>
      {groups.map((group, gi) => {
        const content = group.tokens.map(renderToken)
        if (group.paraIdx >= 0) {
          return <p key={gi} style={{ margin: '0.5em 0' }}>{content}</p>
        }
        const headingFmt = group.tokens.find(t => t.formatting?.startsWith('heading'))?.formatting
        const Tag = headingFmt === 'heading-1' ? 'h1' : headingFmt === 'heading-2' ? 'h2' : headingFmt === 'heading-3' ? 'h3' : 'div'
        const headingStyle: React.CSSProperties = {
          margin: '1em 0 0.25em',
          fontFamily: 'Georgia, "Linux Libertine", serif',
          ...(headingFmt === 'heading-2' ? {
            fontSize: '1.5em', fontWeight: 'bold',
            borderBottom: '1px solid #a2a9b1', paddingBottom: '0.2em',
          } : {}),
          ...(headingFmt === 'heading-3' ? { fontSize: '1.17em', fontWeight: 'bold' } : {}),
          ...(headingFmt === 'heading-1' ? { fontSize: '2em', fontWeight: 'bold' } : {}),
        }
        return <Tag key={gi} style={headingStyle}>{content}</Tag>
      })}
    </div>
  )
}
