import type { CSSProperties } from 'react'
import type { DashboardSummary, TrackedState } from '../utils/aggregations'

interface SummaryCardsProps extends DashboardSummary {
  totalItems?: number
}

const STATE_CARD_CONFIG: Record<
  TrackedState,
  { accent: string; icon: string }
> = {
  Open: { accent: '#3b82f6', icon: '🔵' },
  'In Progress': { accent: '#8b5cf6', icon: '⚙️' },
  Resolved: { accent: '#22c55e', icon: '✅' },
  'Pending Certification': { accent: '#eab308', icon: '📋' },
  Suspended: { accent: '#94a3b8', icon: '⏸️' },
}

export function SummaryCards({
  total,
  totalItems,
  open,
  closed,
  byState,
}: SummaryCardsProps) {
  const cards = [
    {
      label: 'Registros cargados',
      value: totalItems ? `${total} / ${totalItems}` : String(total),
      hint: totalItems ? 'Abiertos + cerrados del API' : undefined,
      accent: '#6366f1',
      icon: '📋',
    },
    {
      label: 'Abiertos',
      value: open,
      hint: `${total ? Math.round((open / total) * 100) : 0}% del total`,
      accent: '#f97316',
      icon: '🔓',
    },
    {
      label: 'Cerrados',
      value: closed,
      hint: `${total ? Math.round((closed / total) * 100) : 0}% del total`,
      accent: '#14b8a6',
      icon: '✅',
    },
    ...Object.entries(STATE_CARD_CONFIG).map(([state, config]) => ({
      label: state,
      value: byState[state as TrackedState],
      hint: `${total ? Math.round((byState[state as TrackedState] / total) * 100) : 0}% del total`,
      accent: config.accent,
      icon: config.icon,
    })),
  ]
  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article
          key={card.label}
          className="summary-card"
          style={{ '--accent': card.accent } as CSSProperties}
        >
          <div className="summary-card-top">
            <span className="summary-icon" aria-hidden>
              {card.icon}
            </span>
            <span className="summary-label">{card.label}</span>
          </div>
          <strong className="summary-value">{card.value}</strong>
          {card.hint && <span className="summary-hint">{card.hint}</span>}
        </article>
      ))}
    </section>
  )
}
