'use client'

// =====================================================
// CaseTimeline — vertical timeline of case_updates.
// -----------------------------------------------------
// Pure renderer + live subscription. No fallback synthetic
// nodes: what you see is exactly what is in case_updates.
// =====================================================

import { useEffect, useState } from 'react'
import { Loader2, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { listCaseUpdates } from '@/lib/cases/queries'
import type { CaseUpdateRow } from '@/lib/cases/types'
import { STATUS_COLOR } from '@/lib/cases/statuses'
import { fmtDateTime } from '@/lib/cases/formatCase'

interface Props {
  caseId: string
  language?: 'ar' | 'en'
}

export default function CaseTimeline({ caseId, language = 'ar' }: Props) {
  const isAr = language === 'ar'
  const [rows, setRows]     = useState<CaseUpdateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const data = await listCaseUpdates(caseId)
      if (!mounted) return
      setRows(data); setLoading(false)
    }
    void load()

    // Live-append new updates the moment they are inserted.
    const supabase = createClient()
    const ch = supabase
      .channel(`timeline-${caseId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_updates', filter: `case_id=eq.${caseId}` },
        () => { void load() }
      )
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [caseId])

  if (loading) {
    return (
      <div className="py-6 text-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin inline-block" />
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        {isAr ? 'لا توجد تحديثات بعد' : 'No updates yet'}
      </div>
    )
  }

  return (
    <ol className="relative border-s border-gray-200 dark:border-slate-700 ps-4 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      {rows.map((u) => {
        const badge = STATUS_COLOR[u.status as keyof typeof STATUS_COLOR]
          || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        return (
          <li key={u.id} className="relative">
            <span className="absolute -start-[22px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-white dark:ring-slate-900" />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge}`}>
                {u.status}
              </span>
              <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                {u.updated_by_name || (isAr ? 'مستخدم' : 'User')}
              </span>
              <span className="text-[11px] text-gray-400 font-mono">{fmtDateTime(u.created_at)}</span>
              {u.source === 'trigger' && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                  auto
                </span>
              )}
            </div>
            {u.note && (
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {u.note}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
