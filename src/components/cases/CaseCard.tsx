'use client'

// =====================================================
// CaseCard — compact card for an open case in the Daily Update.
// Shows: case #, plate, project, expected completion, days in shop,
//        last update, and status badge. Expected date is edited
//        from the case detail page (kept light here).
// =====================================================

import Link from 'next/link'
import { Briefcase, Car, Clock, ExternalLink, Sparkles } from 'lucide-react'
import type { CaseRow } from '@/lib/cases/types'
import { STATUS_COLOR } from '@/lib/cases/statuses'
import { daysSince, expectedDueLabel, relativeTime } from '@/lib/cases/formatCase'
import CaseUpdateForm from './CaseUpdateForm'

interface Props {
  c: CaseRow
  isAr: boolean
  highlight?: boolean
  onSaved?: () => void
}

export default function CaseCard({ c, isAr, highlight, onSaved }: Props) {
  const badge = STATUS_COLOR[c.status as keyof typeof STATUS_COLOR]
    || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'

  const days = daysSince(c.received_at)
  const last = relativeTime(c.last_updated_at, isAr)
  const due  = expectedDueLabel(c.expected_completion_date, isAr)
  const dueClass =
    due?.tone === 'overdue' ? 'text-red-600 dark:text-red-400 font-semibold'
    : due?.tone === 'near'  ? 'text-orange-600 dark:text-orange-400 font-semibold'
    :                         'text-gray-500 dark:text-gray-400'

  return (
    <div
      id={`case-${c.id}`}
      className={`rounded-xl border bg-white dark:bg-slate-900 p-4 transition-all shadow-sm ${
        highlight
          ? 'border-red-500 ring-2 ring-red-300 dark:ring-red-700 animate-pulse'
          : 'border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700'
      }`}
    >
      {/* Top row: number + plate + status badge */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/job-cards/${c.id}`}
            className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-red-600 hover:underline"
          >
            {c.job_card_number}
            <ExternalLink className="w-3 h-3" />
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
            <Car className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium">{c.vehicle?.plate_number ?? '—'}</span>
            <span className="text-gray-400 text-xs truncate">
              {[c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ')}
            </span>
          </p>

          {/* Meta chips: project · expected · days · last update */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {c.vehicle?.project_code && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                <Briefcase className="w-3 h-3" />
                {c.vehicle.project_code}
              </span>
            )}
            {due && (
              <span className={`text-[11px] ${dueClass}`}>
                {due.text}
              </span>
            )}
            {days !== null && (
              <span
                title={isAr ? 'عدد الأيام في الورشة' : 'Days in workshop'}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
                  days > 3
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Clock className="w-3 h-3" />
                {isAr ? `${days} يوم في الورشة` : `${days}d in shop`}
              </span>
            )}
            {last && (
              <span
                title={isAr ? 'آخر تحديث' : 'Last update'}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[11px]"
              >
                <Sparkles className="w-3 h-3" />
                {isAr ? `آخر تحديث: ${last}` : `Updated ${last}`}
              </span>
            )}
          </div>
        </div>

        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${badge} whitespace-nowrap`}>
          {c.status}
        </span>
      </div>

      {/* Complaint summary (optional) */}
      {c.complaint_description && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {c.complaint_description}
        </p>
      )}

      {/* Inline update form */}
      <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-3">
        <CaseUpdateForm
          caseId={c.id}
          currentStatus={c.status}
          isAr={isAr}
          onSaved={onSaved}
        />
      </div>
    </div>
  )
}
