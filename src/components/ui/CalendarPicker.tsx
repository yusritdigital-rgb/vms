'use client'

// =====================================================
// Lightweight monthly calendar picker — zero dependencies.
// Visuals tuned to the dashboard (red = brand, soft shadows,
// 12px radius). RTL-aware but kept visually symmetric so it
// works in both directions.
// =====================================================

import { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  AR_MONTHS,
  AR_WEEKDAYS_SHORT,
  sameDay,
  startOfDay,
} from '@/lib/appointments/types'

interface Props {
  value: Date | null
  onChange: (d: Date) => void
  /** Disallow dates strictly before today (local). Default true. */
  disablePast?: boolean
  /** Hard min / max bounds (inclusive). Overrides disablePast if needed. */
  minDate?: Date
  maxDate?: Date
  className?: string
}

export default function CalendarPicker({
  value,
  onChange,
  disablePast = true,
  minDate,
  maxDate,
  className = '',
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), [])

  // What month is currently displayed (1st of that month).
  const [cursor, setCursor] = useState<Date>(() => {
    const base = value ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // If the selected value changes externally, jump the view to it.
  useEffect(() => {
    if (value) setCursor(new Date(value.getFullYear(), value.getMonth(), 1))
  }, [value])

  const firstDayOfMonth = cursor.getDay() // 0=Sun
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()

  const cells = useMemo(() => {
    // 6 rows × 7 cols grid of Date | null, filling leading/trailing blanks.
    const arr: (Date | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    }
    while (arr.length % 7 !== 0) arr.push(null)
    // Ensure at least 6 rows so the calendar height doesn't jump.
    while (arr.length < 42) arr.push(null)
    return arr
  }, [cursor, firstDayOfMonth, daysInMonth])

  const isDisabled = (d: Date): boolean => {
    if (disablePast && startOfDay(d).getTime() < today.getTime()) return true
    if (minDate && startOfDay(d).getTime() < startOfDay(minDate).getTime()) return true
    if (maxDate && startOfDay(d).getTime() > startOfDay(maxDate).getTime()) return true
    return false
  }

  const shiftMonth = (delta: number) => {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    if (!isDisabled(today)) onChange(today)
  }

  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm ${className}`}>
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 transition-colors"
          aria-label="Previous month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {AR_MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            type="button"
            onClick={goToday}
            className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            اليوم
          </button>
        </div>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 transition-colors"
          aria-label="Next month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {AR_WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1.5 select-none">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />
          const disabled = isDisabled(d)
          const isToday = sameDay(d, today)
          const isSel   = value && sameDay(d, value)
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onChange(d)}
              disabled={disabled}
              className={[
                'aspect-square flex items-center justify-center text-[13px] rounded-lg transition-all select-none',
                disabled
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 active:scale-95',
                isSel
                  ? '!bg-red-600 !text-white font-bold shadow-sm shadow-red-600/30 hover:!bg-red-700'
                  : '',
                !isSel && isToday
                  ? 'ring-1 ring-red-400 text-red-700 dark:text-red-300 font-semibold'
                  : '',
              ].join(' ')}
              aria-pressed={!!isSel}
              aria-label={`${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
