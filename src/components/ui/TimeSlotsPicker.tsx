'use client'

// =====================================================
// Time-slots grid picker with a free-type "Other" fallback.
//   • Slots: 08:00 → 17:30 by default (30-min step)
//   • Each slot is a chip; selected = red pill
//   • The "Other" chip opens a small HH:MM input for edge cases
// =====================================================

import { useMemo, useState, useEffect } from 'react'
import { Clock, Check } from 'lucide-react'
import {
  buildTimeSlots,
  formatTimeLabelAr,
  normaliseTime,
} from '@/lib/appointments/types'

interface Props {
  value: string                              // "HH:MM" or ''
  onChange: (time: string) => void
  startHour?: number
  endHour?: number
  stepMinutes?: number
  className?: string
  /** Map of "HH:MM" → existing booking count for the selected date. */
  counts?: Record<string, number>
  /** Hard cap per slot. Default = 2. */
  maxPerSlot?: number
}

export default function TimeSlotsPicker({
  value,
  onChange,
  startHour = 8,
  endHour = 18,
  stepMinutes = 30,
  className = '',
  counts = {},
  maxPerSlot = 2,
}: Props) {
  const slots = useMemo(
    () => buildTimeSlots({ startHour, endHour, stepMinutes }),
    [startHour, endHour, stepMinutes]
  )

  const normalised = normaliseTime(value)
  const isStandard = normalised && slots.includes(normalised)
  const [otherOpen, setOtherOpen] = useState<boolean>(Boolean(normalised && !isStandard))
  const [otherValue, setOtherValue] = useState<string>(
    normalised && !isStandard ? normalised : ''
  )

  // Keep internal "other" state in sync if parent clears / sets value.
  useEffect(() => {
    if (!normalised) {
      setOtherOpen(false)
      setOtherValue('')
    } else if (!slots.includes(normalised)) {
      setOtherOpen(true)
      setOtherValue(normalised)
    }
  }, [normalised, slots])

  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <Clock className="w-4 h-4 text-red-600" />
        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">اختر الوقت</h4>
        {normalised && (
          <span className="ms-auto text-[11px] text-gray-400">
            المحدد: <span className="text-red-600 font-bold">{formatTimeLabelAr(normalised)}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {slots.map((s) => {
          const selected = s === normalised
          const count = counts[s] ?? 0
          const isFull = count >= maxPerSlot && !selected
          return (
            <button
              key={s}
              type="button"
              disabled={isFull}
              onClick={() => { if (isFull) return; onChange(s); setOtherOpen(false) }}
              title={isFull ? 'ممتلئ' : `${count}/${maxPerSlot}`}
              className={[
                'relative pt-2 pb-4 rounded-xl text-[12.5px] font-semibold transition-all select-none',
                isFull
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 dark:bg-slate-800/60 dark:text-gray-600 dark:border-slate-700 cursor-not-allowed'
                  : selected
                    ? 'bg-red-600 text-white shadow-sm shadow-red-600/30 active:scale-95'
                    : 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-700 border border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-red-900/30 dark:hover:text-red-300 active:scale-95',
              ].join(' ')}
              aria-pressed={selected}
              aria-disabled={isFull}
            >
              {s}
              {selected && <Check className="w-3 h-3 absolute top-1 end-1" />}
              <span
                className={[
                  'absolute bottom-0.5 inset-x-0 text-[9.5px] font-bold tracking-wide',
                  isFull
                    ? 'text-red-500'
                    : selected
                      ? 'text-white/90'
                      : count > 0 ? 'text-amber-600' : 'text-gray-400',
                ].join(' ')}
              >
                {isFull ? 'ممتلئ' : `${count}/${maxPerSlot}`}
              </span>
            </button>
          )
        })}

        {/* "Other" chip */}
        <button
          type="button"
          onClick={() => setOtherOpen(o => !o)}
          className={[
            'py-2 rounded-xl text-[12.5px] font-semibold transition-all border-dashed border',
            otherOpen || (normalised && !isStandard)
              ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-slate-600 text-gray-500 hover:border-red-400 hover:text-red-600',
          ].join(' ')}
        >
          أخرى…
        </button>
      </div>

      {otherOpen && (
        <div className="mt-3 flex items-center gap-2 p-2 bg-red-50/60 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 rounded-xl">
          <Clock className="w-4 h-4 text-red-600 shrink-0" />
          <input
            type="time"
            value={otherValue}
            onChange={(e) => {
              setOtherValue(e.target.value)
              if (e.target.value) onChange(e.target.value)
            }}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <span className="text-[11px] text-gray-500">أدخل وقتاً مخصصاً</span>
        </div>
      )}
    </div>
  )
}
