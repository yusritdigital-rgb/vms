'use client'

// Generic searchable select. Visually matches the existing input/select
// style used across the dashboard (same border, focus ring, dark-mode
// treatment). Works for vehicles, workshops, or any list of options.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, ChevronDown, Check } from 'lucide-react'

export interface SearchableOption<T = any> {
  value: string
  label: string
  sublabel?: string
  /** Haystack used for matching (concat of plate/chassis/city/etc). */
  searchText?: string
  raw?: T
}

interface Props<T> {
  options: SearchableOption<T>[]
  value: string
  onChange: (value: string, option: SearchableOption<T> | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  required?: boolean
  className?: string
  dir?: 'rtl' | 'ltr'
}

export default function SearchableSelect<T = any>({
  options,
  value,
  onChange,
  placeholder = '-- اختر --',
  searchPlaceholder = 'بحث...',
  emptyText = 'لا توجد نتائج',
  disabled,
  required,
  className = '',
  dir = 'rtl',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter(o => {
      const hay = (o.searchText ?? `${o.label} ${o.sublabel ?? ''}`).toLowerCase()
      return hay.includes(needle)
    })
  }, [options, q])

  return (
    <div ref={ref} className={`relative ${className}`} dir={dir}>
      {/* Trigger — styled identically to the other form inputs */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-2 border rounded-lg text-sm text-start flex items-center justify-between gap-2 transition-colors
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-red-300 dark:hover:border-red-500'}
          ${selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}
          border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800`}
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.label}</span>
              {selected.sublabel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ms-2">{selected.sublabel}</span>
              )}
            </>
          ) : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && !required && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange('', null) }}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
              aria-label="clear"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full ps-8 pe-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">{emptyText}</div>
            ) : (
              filtered.map(o => {
                const isSel = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value, o); setOpen(false); setQ('') }}
                    className={`w-full text-start px-3 py-2 flex items-center justify-between gap-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors
                      ${isSel ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{o.label}</div>
                      {o.sublabel && (
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">{o.sublabel}</div>
                      )}
                    </div>
                    {isSel && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
