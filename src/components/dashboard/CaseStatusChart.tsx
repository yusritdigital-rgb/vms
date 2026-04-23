'use client'

// =====================================================
// CaseStatusChart (توزيع الحالات)
// -----------------------------------------------------
// Renamed from JobCardStatusChart. No more "job card" wording in
// the UI or file name.
//
// Shows every case status as a row: name · count · % · progress bar.
//
// Guarantees:
//   • Never produces NaN. When total === 0, every row renders as 0%.
//   • When `includeZeros` is passed, every approved status renders
//     even if its count is 0 — used by the main dashboard so the
//     operator always sees the full approved workflow.
// =====================================================

import { useTranslation } from '@/hooks/useTranslation'
import { PieChart } from 'lucide-react'

interface CaseStatusChartProps {
  /**
   * Full distribution { statusLabel: count }.
   * By default, statuses with a count of zero are hidden; pass
   * `includeZeros` to force every label to render.
   */
  distribution: Record<string, number>
  includeZeros?: boolean
}

// Qualitative palette — enough distinct hues for all 17 statuses,
// no red/green/amber overload in a single group.
const PALETTE = [
  '#DC2626', '#f59e0b', '#10b981', '#94a3b8',
  '#6366f1', '#ec4899', '#0ea5e9', '#8b5cf6',
  '#f97316', '#14b8a6', '#a855f7', '#eab308',
  '#ef4444', '#06b6d4', '#84cc16', '#64748b', '#d946ef',
]

export default function CaseStatusChart(props: CaseStatusChartProps) {
  const { t } = useTranslation()

  const itemsRaw: { label: string; value: number }[] =
    Object.entries(props.distribution ?? {})
      .filter(([, v]) => (props.includeZeros ? true : (v ?? 0) > 0))
      .map(([label, value]) => ({
        label,
        value: Number.isFinite(value) ? value : 0,
      }))

  // Sort largest-first so the list reads meaningfully.
  const items = itemsRaw
    .sort((a, b) => b.value - a.value)
    .map((it, i) => ({ ...it, color: PALETTE[i % PALETTE.length] }))

  // Robust math — guards against divide-by-zero and non-finite values.
  const total = items.reduce(
    (sum, b) => sum + (Number.isFinite(b.value) ? b.value : 0),
    0
  )
  const pct = (v: number) => {
    if (!Number.isFinite(v) || total <= 0) return 0
    return Math.max(0, Math.min(100, (v / total) * 100))
  }
  const maxValue = items.reduce((m, b) => Math.max(m, b.value || 0), 0)
  const barWidth = (v: number) => {
    if (!Number.isFinite(v) || maxValue <= 0) return 0
    return Math.max(0, Math.min(100, (v / maxValue) * 100))
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <PieChart className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {t('dashboard.statusDistribution')}
          </h3>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          {total.toLocaleString('en-US')}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">—</p>
      ) : (
        <ul className="space-y-3 max-h-[420px] overflow-y-auto pe-1">
          {items.map((item) => {
            const share = pct(item.value)
            const width = barWidth(item.value)
            return (
              <li key={item.label} className="group">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {item.value.toLocaleString('en-US')}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {share.toFixed(share >= 10 ? 0 : 1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${width}%`, backgroundColor: item.color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
