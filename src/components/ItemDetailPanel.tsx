import { useEffect, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import type { ItemDeliveryDates } from '../types/additionalField'
import type { ItemAttachment } from '../types/attachment'
import { formatDate, getProgressTone } from '../utils/aggregations'
import {
  formatDeliveryDate,
  formatDeliveryTestDate,
  formatUltimaIteracionDate,
} from '../utils/deliveryDates'
import {
  fetchFileBlob,
  fetchItemFiles,
  formatFileSize,
  getPreviewKind,
  type PreviewKind,
} from '../services/attachmentService'
import { AttachmentZoomModal } from './AttachmentZoomModal'

interface ItemDetailPanelProps {
  item: IncidentItem | null
  onClose: () => void
  deliveryDatesById?: Map<number, ItemDeliveryDates>
}

interface FilePreview {
  name: string
  url: string
  kind: PreviewKind
  contentType: string
}

export function ItemDetailPanel({
  item,
  onClose,
  deliveryDatesById,
}: ItemDetailPanelProps) {
  const [files, setFiles] = useState<ItemAttachment[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [zoomOpen, setZoomOpen] = useState(false)

  useEffect(() => {
    if (!item) return

    let cancelled = false
    setFiles([])
    setFilesError(null)
    setPreview(null)
    setPreviewError(null)
    setZoomOpen(false)
    setFilesLoading(true)

    void fetchItemFiles(item.id, item.itemType)
      .then((content) => {
        if (!cancelled) setFiles(content)
      })
      .catch((error) => {
        if (!cancelled) {
          setFilesError(
            error instanceof Error ? error.message : 'Error al cargar adjuntos',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [item])

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [preview?.url])

  if (!item) return null

  const closePreview = () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
    }
    setPreview(null)
    setPreviewError(null)
    setZoomOpen(false)
  }

  const openAttachment = async (file: ItemAttachment) => {
    setPreviewLoading(true)
    setPreviewError(null)

    if (preview?.url) {
      URL.revokeObjectURL(preview.url)
      setPreview(null)
    }

    try {
      const { blob, contentType } = await fetchFileBlob(file.id, file.name)
      const kind = getPreviewKind(file.name, contentType)
      const url = URL.createObjectURL(blob)
      setPreview({ name: file.name, url, kind, contentType })
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : 'No se pudo abrir el adjunto',
      )
    } finally {
      setPreviewLoading(false)
    }
  }

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
            <dt>Fecha de Entrega</dt>
            <dd>{formatDeliveryDate(item, deliveryDatesById)}</dd>
          </div>
          <div>
            <dt>Fecha Entrega TEST</dt>
            <dd>{formatDeliveryTestDate(item, deliveryDatesById)}</dd>
          </div>
          <div>
            <dt>Fecha Gestión AFC</dt>
            <dd>{formatUltimaIteracionDate(item, deliveryDatesById)}</dd>
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

        <section className="detail-attachments">
          <div className="detail-attachments-header">
            <h3>Adjuntos</h3>
            {!filesLoading && (
              <span className="detail-attachments-count">
                {files.length} archivo{files.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {filesLoading && <p className="detail-attachments-muted">Cargando adjuntos...</p>}
          {filesError && <p className="detail-attachments-error">{filesError}</p>}

          {!filesLoading && !filesError && files.length === 0 && (
            <p className="detail-attachments-muted">Este ticket no tiene adjuntos</p>
          )}

          {!filesLoading && !filesError && files.length > 0 && (
            <ul className="attachment-list">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="attachment-item"
                    onClick={() => void openAttachment(file)}
                    disabled={previewLoading}
                  >
                    <span className="attachment-name">{file.name}</span>
                    <span className="attachment-meta">
                      {formatFileSize(file.size)} · {file.userName} ·{' '}
                      {formatDate(file.date)}
                    </span>
                    {file.description.trim() && (
                      <span className="attachment-description">{file.description}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {previewLoading && (
            <p className="detail-attachments-muted">Abriendo adjunto...</p>
          )}
          {previewError && (
            <p className="detail-attachments-error">{previewError}</p>
          )}

          {preview && (
            <div className="attachment-preview">
              <div className="attachment-preview-header">
                <strong>{preview.name}</strong>
                <div className="attachment-preview-actions">
                  {preview.kind !== 'unsupported' && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setZoomOpen(true)}
                    >
                      Ampliar
                    </button>
                  )}
                  <button type="button" className="ghost-button" onClick={closePreview}>
                    Cerrar vista
                  </button>
                </div>
              </div>

              {preview.kind === 'image' && (
                <button
                  type="button"
                  className="attachment-preview-image-button"
                  onClick={() => setZoomOpen(true)}
                  aria-label={`Ampliar ${preview.name}`}
                >
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="attachment-preview-image"
                  />
                </button>
              )}

              {preview.kind === 'pdf' && (
                <embed
                  src={preview.url}
                  type="application/pdf"
                  title={preview.name}
                  className="attachment-preview-frame"
                />
              )}

              {preview.kind === 'text' && (
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="attachment-preview-frame"
                />
              )}

              {preview.kind === 'unsupported' && (
                <div className="attachment-preview-fallback">
                  <p>Vista previa no disponible para este tipo de archivo.</p>
                  <a href={preview.url} download={preview.name} className="ghost-button">
                    Descargar {preview.name}
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        {zoomOpen && preview && (
          <AttachmentZoomModal
            name={preview.name}
            url={preview.url}
            kind={preview.kind}
            onClose={() => setZoomOpen(false)}
          />
        )}
      </aside>
    </div>
  )
}
