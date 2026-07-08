import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CountItem } from '../types/incident'
import { truncateLabel } from '../utils/aggregations'

interface CountChartProps {
  title: string
  data: CountItem[]
  color: string
  maxItems?: number
}

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#3b82f6',
  '#ef4444',
]

function estimateYAxisWidth(labels: string[]): number {
  const longest = Math.max(...labels.map((label) => label.length), 8)
  return Math.min(Math.max(longest * 6.5 + 20, 120), 420)
}

export function BarCountChart({
  title,
  data,
  color,
  maxItems = 10,
}: CountChartProps) {
  const chartData = data.slice(0, maxItems)
  const yAxisWidth = estimateYAxisWidth(chartData.map((item) => item.name))
  const chartHeight = Math.max(300, chartData.length * 30 + 48)

  if (chartData.length === 0) {
    return (
      <article className="chart-card">
        <h3>{title}</h3>
        <p className="empty-chart">Sin datos para mostrar</p>
      </article>
    )
  }

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="chart-container" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={yAxisWidth}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number) => [value, 'Cantidad']}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.name ?? ''
              }
            />
            <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

export function PieCountChart({
  title,
  data,
  maxItems = 6,
}: Omit<CountChartProps, 'color'>) {
  const chartData = data.slice(0, maxItems)
  const otherCount = data
    .slice(maxItems)
    .reduce((sum, item) => sum + item.count, 0)

  const finalData =
    otherCount > 0
      ? [...chartData, { name: 'Otros', count: otherCount }]
      : chartData

  if (finalData.length === 0) {
    return (
      <article className="chart-card">
        <h3>{title}</h3>
        <p className="empty-chart">Sin datos para mostrar</p>
      </article>
    )
  }

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="chart-container pie">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={finalData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${truncateLabel(name, 14)} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
            >
              {finalData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, 'Cantidad']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
