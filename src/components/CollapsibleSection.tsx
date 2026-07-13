import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  id?: string
  title: string
  description?: string
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}

export function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = false,
  className = '',
  children,
}: CollapsibleSectionProps) {
  return (
    <details
      id={id}
      className={`collapsible-section panel ${className}`.trim()}
      open={defaultOpen || undefined}
    >
      <summary className="collapsible-summary">
        <div className="collapsible-heading">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className="collapsible-toggle">Mostrar / ocultar</span>
      </summary>

      <div className="collapsible-content">{children}</div>
    </details>
  )
}
