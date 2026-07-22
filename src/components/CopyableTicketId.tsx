import { useRef, useState } from 'react'

interface CopyableTicketIdProps {
  value: string
  className?: string
}

const PRESS_ANIMATION_MS = 480

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function CopyableTicketId({ value, className = '' }: CopyableTicketIdProps) {
  const [pressing, setPressing] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const triggerPressEffect = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    setPressing(false)
    window.requestAnimationFrame(() => {
      setPressing(true)
      timeoutRef.current = window.setTimeout(() => {
        setPressing(false)
        timeoutRef.current = null
      }, PRESS_ANIMATION_MS)
    })
  }

  const copyId = async () => {
    const success = await copyText(value)
    if (!success) return
    triggerPressEffect()
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !rootRef.current) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    const anchor = selection.anchorNode
    const focus = selection.focusNode
    if (
      !rootRef.current.contains(anchor) ||
      !rootRef.current.contains(focus)
    ) {
      return
    }

    void copyId()
  }

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()

    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      return
    }

    void copyId()
  }

  return (
    <span
      ref={rootRef}
      className={`copyable-ticket-id ${pressing ? 'is-pressing' : ''} ${className}`.trim()}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Copiar ID ${value}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          void copyId()
        }
      }}
    >
      <span className="copyable-ticket-id-text">{value}</span>
    </span>
  )
}
