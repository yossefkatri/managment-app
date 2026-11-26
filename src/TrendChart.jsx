import { useMemo, useRef, useState } from 'react'

const W = 680
const H = 280
const M = { top: 16, right: 20, bottom: 32, left: 64 }
const PW = W - M.left - M.right
const PH = H - M.top - M.bottom

const SERIES = [
  { key: 'income', label: 'הכנסות', color: 'var(--viz-income)' },
  { key: 'expense', label: 'הוצאות', color: 'var(--viz-expense)' },
  { key: 'balance', label: 'יתרה מצטברת', color: 'var(--viz-balance)', dashed: true },
]

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('he-IL', { notation: 'compact', maximumFractionDigits: 1 })
const monthLabel = new Intl.DateTimeFormat('he-IL', { month: 'short', year: '2-digit' })
const monthLong = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })

const toDate = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
const toYm = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Builds one point per month from the first transaction month to the last (or current) month.
function buildMonthlySeries(transactions, currentMonth) {
  if (transactions.length === 0) return []
  const totals = new Map()
  for (const t of transactions) {
    const ym = t.date.slice(0, 7)
    const row = totals.get(ym) ?? { income: 0, expense: 0 }
    row[t.type] += t.amount
    totals.set(ym, row)
  }
  const months = [...totals.keys(), currentMonth].sort()
  const first = toDate(months[0])
  const last = toDate(months[months.length - 1])

  const points = []
  let balance = 0
  for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const ym = toYm(d)
    const { income, expense } = totals.get(ym) ?? { income: 0, expense: 0 }
    balance += income - expense
    points.push({ month: ym, income, expense, balance })
  }
  return points
}

function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v))
  return ticks
}

export default function TrendChart({ transactions, currentMonth, selectedMonth, onSelectMonth }) {
  const points = useMemo(() => buildMonthlySeries(transactions, currentMonth), [transactions, currentMonth])
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)

  if (points.length === 0) {
    return <p className="viz-empty">אין עדיין נתונים להצגה בגרף.</p>
  }

  const values = points.flatMap((p) => [p.income, p.expense, p.balance])
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const x = (i) => M.left + (points.length === 1 ? PW / 2 : (i / (points.length - 1)) * PW)
  const y = (v) => M.top + PH - ((v - yMin) / (yMax - yMin)) * PH
  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ')

  // Show at most ~8 month labels so they never collide
  const labelEvery = Math.ceil(points.length / 8)

  const indexFromEvent = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    if (points.length === 1) return 0
    const i = Math.round(((vx - M.left) / PW) * (points.length - 1))
    return Math.max(0, Math.min(points.length - 1, i))
  }

  const hp = hover != null ? points[hover] : null
  const tooltipLeft = hp ? (x(hover) / W) * 100 : 0

  return (
    <div className="viz-root">
      <div className="viz-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="viz-legend-item">
            <svg width="18" height="10" aria-hidden="true">
              <line
                x1="1" y1="5" x2="17" y2="5"
                stroke={s.color} strokeWidth="2" strokeLinecap="round"
                strokeDasharray={s.dashed ? '4 3' : undefined}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>

      <div className="viz-plot" dir="ltr">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="גרף הכנסות, הוצאות ויתרה מצטברת לפי חודש"
          onMouseMove={(e) => setHover(indexFromEvent(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => onSelectMonth?.(points[indexFromEvent(e)].month)}
          style={{ cursor: onSelectMonth ? 'pointer' : 'default', display: 'block', touchAction: 'pan-y' }}
        >
          {/* grid + y axis */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)}
                className={t === 0 ? 'viz-zero' : 'viz-grid'}
              />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="viz-tick">
                {compact.format(t)}
              </text>
            </g>
          ))}

          {/* x axis labels */}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={p.month} x={x(i)} y={H - 8} textAnchor="middle"
                className={p.month === selectedMonth ? 'viz-tick viz-tick-active' : 'viz-tick'}
              >
                {monthLabel.format(toDate(p.month))}
              </text>
            ) : null,
          )}

          {/* crosshair */}
          {hp && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + PH} className="viz-crosshair" />}

          {/* lines */}
          {SERIES.map((s) => (
            <path
              key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
            />
          ))}

          {/* markers (bigger on hover) */}
          {SERIES.map((s) =>
            points.map((p, i) => (
              <circle
                key={`${s.key}-${p.month}`} cx={x(i)} cy={y(p[s.key])}
                r={hover === i ? 5.5 : 3.5} fill={s.color} className="viz-marker"
              />
            )),
          )}
        </svg>

        {hp && (
          <div
            className="viz-tooltip"
            dir="rtl"
            style={{
              left: `${tooltipLeft}%`,
              transform: `translateX(${tooltipLeft > 60 ? '-105%' : '5%'})`,
            }}
          >
            <div className="viz-tooltip-title">{monthLong.format(toDate(hp.month))}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="viz-tooltip-row">
                <span className="viz-swatch" style={{ background: s.color }} />
                <span className="viz-tooltip-label">{s.label}</span>
                <span className="viz-tooltip-value">{money.format(hp[s.key])}</span>
              </div>
            ))}
            <div className="viz-tooltip-row viz-tooltip-net">
              <span className="viz-tooltip-label">נטו בחודש</span>
              <span className="viz-tooltip-value">{money.format(hp.income - hp.expense)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
