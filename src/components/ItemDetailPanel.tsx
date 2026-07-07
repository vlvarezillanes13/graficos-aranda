import type { IncidentItem } from '../types/incident'
import { formatDate, getProgressTone } from '../utils/aggregations'

interface ItemDetailPanelProps {
  item: IncidentItem | null
  onClose: () => void
}

export function ItemDetailPanel({ item, onClose }: ItemDetailPanelProps) {
  if (!item) return null

  return (
    <div className="detail-overlay" onClick={onClose} role="presentation">
      <aside
        className="detail-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="detail-title"
      >
        <header className="detail-header">
          <div>
            <p className="detail-id">{item.idByProject}</p>
            <h2 id="detail-title">{item.subject}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="detail-progress-block">
          <div className="detail-progress-top">
            <span>Avance del ticket</span>
            <strong>{item.progress}%</strong>
          </div>
          <div className="progress-bar large">
            <span
              className={`progress-fill ${getProgressTone(item.progress)}`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Estado</dt>
            <dd>{item.stateName}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{item.itemTypeName}</dd>
          </div>
          <div>
            <dt>Grupo</dt>
            <dd>{item.groupName}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{item.responsibleName}</dd>
          </div>
          <div>
            <dt>Prioridad</dt>
            <dd>{item.priorityName}</dd>
          </div>
          <div>
            <dt>Urgencia</dt>
            <dd>{item.urgencyName}</dd>
          </div>
          <div>
            <dt>Impacto</dt>
            <dd>{item.impactName}</dd>
          </div>
          <div>
            <dt>Servicio</dt>
            <dd>{item.serviceName}</dd>
          </div>
          <div>
            <dt>Proyecto</dt>
            <dd>{item.projectName}</dd>
          </div>
          <div>
            <dt>Solicitante</dt>
            <dd>{item.customerName}</dd>
          </div>
          <div>
            <dt>Categoría</dt>
            <dd>{item.categoryName}</dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>{item.slaName}</dd>
          </div>
          <div>
            <dt>Apertura</dt>
            <dd>{formatDate(item.openedDate)}</dd>
          </div>
          <div>
            <dt>Modificación</dt>
            <dd>{formatDate(item.modifiedDate)}</dd>
          </div>
        </dl>

        <div className="detail-description">
          <h3>Descripción</h3>
          <p>{item.descriptionNoHtml.trim() || 'Sin descripción'}</p>
        </div>
      </aside>
    </div>
  )
}
