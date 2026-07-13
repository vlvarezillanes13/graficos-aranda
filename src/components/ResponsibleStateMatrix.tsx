import type {
  MatrixSelection,
  ResponsibleStateMatrix,
} from '../utils/aggregations'
import { isMatrixSelectionActive } from '../utils/aggregations'

interface ResponsibleStateMatrixProps {
  matrix: ResponsibleStateMatrix
  activeSelection: MatrixSelection | null
  onSelect: (selection: MatrixSelection) => void
}

function CountCell({
  count,
  selection,
  activeSelection,
  onSelect,
  cellClassName = '',
}: {
  count: number
  selection: MatrixSelection
  activeSelection: MatrixSelection | null
  onSelect: (selection: MatrixSelection) => void
  cellClassName?: string
}) {
  if (count === 0) {
    return (
      <td className={`matrix-count is-zero ${cellClassName}`.trim()}>0</td>
    )
  }

  const isActive = isMatrixSelectionActive(activeSelection, selection)

  return (
    <td
      className={`matrix-count is-clickable${isActive ? ' is-active' : ''} ${cellClassName}`.trim()}
    >
      <button
        type="button"
        className="matrix-count-button"
        onClick={() => onSelect(selection)}
        title="Aplicar filtro"
      >
        {count}
      </button>
    </td>
  )
}

function PersonCell({
  responsible,
  activeSelection,
  onSelect,
}: {
  responsible: string
  activeSelection: MatrixSelection | null
  onSelect: (selection: MatrixSelection) => void
}) {
  const selection: MatrixSelection = { type: 'row', responsible }
  const isActive = isMatrixSelectionActive(activeSelection, selection)

  return (
    <th
      scope="row"
      className={`matrix-sticky-col matrix-person${isActive ? ' is-active-person' : ''}`}
    >
      <button
        type="button"
        className="matrix-person-button"
        onClick={() => onSelect(selection)}
        title="Filtrar por responsable"
      >
        {responsible}
      </button>
    </th>
  )
}

function StateHeader({
  state,
  activeSelection,
  onSelect,
}: {
  state: string
  activeSelection: MatrixSelection | null
  onSelect: (selection: MatrixSelection) => void
}) {
  const selection: MatrixSelection = { type: 'column', state }
  const isActive = isMatrixSelectionActive(activeSelection, selection)

  return (
    <th className={`matrix-state-col${isActive ? ' is-active-state' : ''}`}>
      <button
        type="button"
        className="matrix-state-button"
        onClick={() => onSelect(selection)}
        title="Filtrar por estado"
      >
        {state}
      </button>
    </th>
  )
}

export function ResponsibleStateMatrixTable({
  matrix,
  activeSelection,
  onSelect,
}: ResponsibleStateMatrixProps) {
  if (matrix.rows.length === 0) {
    return (
      <p className="matrix-empty">No hay datos para mostrar con los filtros actuales.</p>
    )
  }

  return (
    <div className="table-wrapper matrix-table-wrapper">
      <table className="matrix-table">
        <thead>
          <tr>
            <th className="matrix-sticky-col">Responsable</th>
            {matrix.states.map((state) => (
              <StateHeader
                key={state}
                state={state}
                activeSelection={activeSelection}
                onSelect={onSelect}
              />
            ))}
            <th className="matrix-total-col">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.responsible}>
              <PersonCell
                responsible={row.responsible}
                activeSelection={activeSelection}
                onSelect={onSelect}
              />
              {matrix.states.map((state) => (
                <CountCell
                  key={state}
                  count={row.counts[state]}
                  selection={{
                    type: 'cell',
                    responsible: row.responsible,
                    state,
                  }}
                  activeSelection={activeSelection}
                  onSelect={onSelect}
                />
              ))}
              <CountCell
                count={row.total}
                selection={{ type: 'row', responsible: row.responsible }}
                activeSelection={activeSelection}
                onSelect={onSelect}
                cellClassName="matrix-total-col"
              />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="matrix-sticky-col">
              Total
            </th>
            {matrix.states.map((state) => (
              <CountCell
                key={state}
                count={matrix.totals[state]}
                selection={{ type: 'column', state }}
                activeSelection={activeSelection}
                onSelect={onSelect}
              />
            ))}
            <td className="matrix-total-col matrix-footer-total">
              {matrix.grandTotal}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
