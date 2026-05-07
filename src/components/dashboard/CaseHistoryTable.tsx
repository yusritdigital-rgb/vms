'use client'

// =====================================================
// CaseHistoryTable (سجل الحالات)
// -----------------------------------------------------
// Replaces the old "Vehicle History" donut chart. Shows ONLY closed
// cases — i.e. status is one of:
//     • تم التسليم للعميل
//     • تم البيع
//     • خسارة كلية
//
// Columns: case number · vehicle · workshop · start date · end date · final status
// =====================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { History, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { CLOSED_STATUSES, STATUS_COLOR } from '@/lib/cases/statuses'
import { format } from 'date-fns'

interface ClosedCaseRow {
  id: string
  job_card_number: string
  status: string
  received_at: string | null
  delivered_at: string | null
  completed_at: string | null
  workshop_name: string | null
  vehicle: { plate_number: string | null; brand?: string | null; model?: string | null } | null
}

export default function CaseHistoryTable() {
  const { language } = useTranslation()
  const [rows, setRows] = useState<ClosedCaseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    // Accept the Arabic closed statuses AND the legacy English 'delivered'
    // so older pre-migration data still shows up.
    const statusFilter: string[] = [...CLOSED_STATUSES, 'delivered']

    const { data, error } = await supabase
      .from('job_cards')
      .select(`
        id, job_card_number, status, received_at, delivered_at, completed_at,
        workshop_name,
        vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, brand, model)
      `)
      .in('status', statusFilter)
      .order('completed_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('[CaseHistoryTable] load failed', error)
      setRows([])
    } else {
      setRows((data as unknown as ClosedCaseRow[]) ?? [])
    }
    setLoading(false)
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    try { return format(new Date(iso), 'yyyy-MM-dd') } catch { return '—' }
  }

  const isAr = language === 'ar'

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {isAr ? 'سجل الحالات' : 'Case History'}
            </h3>
            <p className="text-[11px] text-gray-400">
              {isAr ? 'آخر 25 حالة مغلقة' : 'Last 25 closed cases'}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          {rows.length.toLocaleString('en-US')}
        </span>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin inline-block" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">
          {isAr ? 'لا توجد حالات مغلقة بعد' : 'No closed cases yet'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-800">
                <th className="text-start py-2 pe-3 font-medium">{isAr ? 'رقم الحالة' : 'Case #'}</th>
                <th className="text-start py-2 px-3 font-medium">{isAr ? 'المركبة' : 'Vehicle'}</th>
                <th className="text-start py-2 px-3 font-medium">{isAr ? 'الورشة' : 'Workshop'}</th>
                <th className="text-start py-2 px-3 font-medium">{isAr ? 'تاريخ البدء' : 'Start'}</th>
                <th className="text-start py-2 px-3 font-medium">{isAr ? 'تاريخ الإغلاق' : 'End'}</th>
                <th className="text-start py-2 ps-3 font-medium">{isAr ? 'الحالة النهائية' : 'Final Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = STATUS_COLOR[r.status as keyof typeof STATUS_COLOR]
                  || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                const endDate = r.completed_at || r.delivered_at
                return (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 pe-3">
                      <Link href="/history" className="font-mono text-xs font-semibold text-red-600 hover:underline">
                        {r.job_card_number}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200">
                      {r.vehicle?.plate_number || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                      {r.workshop_name || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(r.received_at)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {fmtDate(endDate)}
                    </td>
                    <td className="py-2.5 ps-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
