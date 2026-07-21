import { useEffect, useMemo, useState } from 'react'
import type { IncidentItem } from '../types/incident'
import type { AssignmentGroup, AssignmentSpecialist } from '../types/assignment'
import {
  assignTicketResponsible,
  fetchAssignmentGroups,
  fetchGroupSpecialists,
} from '../services/ticketAssignmentService'

interface ChangeResponsibleSectionProps {
  item: IncidentItem
  active: boolean
  onAssigned?: () => void
}

export function ChangeResponsibleSection({
  item,
  active,
  onAssigned,
}: ChangeResponsibleSectionProps) {
  const [groups, setGroups] = useState<AssignmentGroup[]>([])
  const [specialists, setSpecialists] = useState<AssignmentSpecialist[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number>(item.groupId)
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<number>(
    item.responsibleId,
  )
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [specialistsLoading, setSpecialistsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setSelectedGroupId(item.groupId)
    setSelectedResponsibleId(item.responsibleId)
    setSuccess(null)
    setError(null)
  }, [item.id, item.groupId, item.responsibleId])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setGroupsLoading(true)
    setError(null)

    void fetchAssignmentGroups(item.serviceId, item.stateId)
      .then((content) => {
        if (cancelled) return
        setGroups(content)

        if (!content.some((group) => group.id === item.groupId) && content.length > 0) {
          setSelectedGroupId(content[0].id)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Error al cargar grupos',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [active, item.id, item.serviceId, item.stateId, item.groupId])

  useEffect(() => {
    if (!active || !selectedGroupId) {
      setSpecialists([])
      return
    }

    let cancelled = false
    setSpecialistsLoading(true)
    setError(null)

    void fetchGroupSpecialists(selectedGroupId, item.projectId)
      .then((content) => {
        if (cancelled) return
        setSpecialists(content)

        setSelectedResponsibleId((current) => {
          if (content.some((specialist) => specialist.id === current)) {
            return current
          }

          if (
            selectedGroupId === item.groupId &&
            content.some((specialist) => specialist.id === item.responsibleId)
          ) {
            return item.responsibleId
          }

          return content[0]?.id ?? 0
        })
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSpecialists([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Error al cargar responsables',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setSpecialistsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    active,
    item.id,
    item.projectId,
    item.groupId,
    item.responsibleId,
    selectedGroupId,
  ])

  const hasChanges = useMemo(
    () =>
      selectedGroupId !== item.groupId ||
      selectedResponsibleId !== item.responsibleId,
    [
      item.groupId,
      item.responsibleId,
      selectedGroupId,
      selectedResponsibleId,
    ],
  )

  const canSubmit =
    hasChanges &&
    selectedGroupId > 0 &&
    selectedResponsibleId > 0 &&
    !groupsLoading &&
    !specialistsLoading &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await assignTicketResponsible(item, selectedGroupId, selectedResponsibleId)
      setSuccess('Responsable actualizado correctamente.')
      onAssigned?.()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo actualizar el responsable',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="assignment-section">
      <header className="assignment-header">
        <h3>Cambiar responsable</h3>
        <p>
          Asigna el ticket a otro grupo y responsable disponible para el estado
          actual.
        </p>
      </header>

      <dl className="assignment-current">
        <div>
          <dt>Grupo actual</dt>
          <dd>{item.groupName}</dd>
        </div>
        <div>
          <dt>Responsable actual</dt>
          <dd>{item.responsibleName}</dd>
        </div>
      </dl>

      <div className="assignment-form">
        <label className="filter-field">
          <span>Nuevo grupo</span>
          <select
            value={selectedGroupId || ''}
            onChange={(event) => {
              setSelectedGroupId(Number(event.target.value))
              setSuccess(null)
            }}
            disabled={groupsLoading || submitting}
          >
            {groupsLoading && <option value="">Cargando grupos...</option>}
            {!groupsLoading && groups.length === 0 && (
              <option value="">Sin grupos disponibles</option>
            )}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Nuevo responsable</span>
          <select
            value={selectedResponsibleId || ''}
            onChange={(event) => {
              setSelectedResponsibleId(Number(event.target.value))
              setSuccess(null)
            }}
            disabled={specialistsLoading || submitting || !selectedGroupId}
          >
            {specialistsLoading && (
              <option value="">Cargando responsables...</option>
            )}
            {!specialistsLoading && specialists.length === 0 && (
              <option value="">Sin responsables disponibles</option>
            )}
            {specialists.map((specialist) => (
              <option key={specialist.id} value={specialist.id}>
                {specialist.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="assignment-message error">{error}</p>}
      {success && <p className="assignment-message success">{success}</p>}

      <div className="assignment-actions">
        <button
          type="button"
          className="assignment-submit-button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {submitting ? 'Guardando...' : 'Actualizar responsable'}
        </button>
      </div>
    </section>
  )
}
