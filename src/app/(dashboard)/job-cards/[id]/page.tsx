'use client'

// =====================================================
// /job-cards/[id] — Case detail
// -----------------------------------------------------
// Full case info + inline status/note update + timeline.
// Replacement vehicle & workshop shown as info blocks.
// No spare-parts UI, no works/damages UI — out of scope
// for the Cases module.
// =====================================================

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Car, Loader2, Wrench, Briefcase, StickyNote, ClipboardList, Gauge, Calendar, CheckCircle,
  UserCircle, Clock,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { getCase } from '@/lib/cases/queries'
import type { CaseRow } from '@/lib/cases/types'
import { isClosedStatus } from '@/lib/cases/types'
import { STATUS_COLOR } from '@/lib/cases/statuses'
import { fmtDateTime } from '@/lib/cases/formatCase'

import CaseUpdateForm from '@/components/cases/CaseUpdateForm'
import CaseTimeline   from '@/components/cases/CaseTimeline'

interface ReplacementVehicle {
  id: string
  plate_number: string | null
  brand: string | null
  model: string | null
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { language } = useTranslation()
  const isAr = language === 'ar'

  const [c, setC] = useState<CaseRow | null>(null)
  const [alt, setAlt] = useState<ReplacementVehicle | null>(null)
  const [updaterName, setUpdaterName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [timelineKey, setTimelineKey] = useState(0)

  const reload = useCallback(async () => {
    const row = await getCase(params.id)
    setC(row)

    const supabase = createClient()

    // Replacement vehicle snapshot
    if (row?.replacement_vehicle_id) {
      const { data } = await supabase
        .from('vehicles')
        .select('id, plate_number, brand, model')
        .eq('id', row.replacement_vehicle_id)
        .maybeSingle()
      setAlt((data as ReplacementVehicle) ?? null)
    } else {
      setAlt(null)
    }

    // Resolve the last updater's display name.
    // Priority: the denormalised `updated_by_name` on the most recent
    // case_updates row (always set for manual updates) → fallback to
    // user_preferences.full_name keyed on job_cards.last_updated_by.
    if (row?.id) {
      let name: string | null = null
      const { data: lastUpd } = await supabase
        .from('case_updates')
        .select('updated_by_name, created_at')
        .eq('case_id', row.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      name = (lastUpd as any)?.updated_by_name ?? null

      if (!name && row.last_updated_by) {
        const { data: pref } = await supabase
          .from('user_preferences')
          .select('full_name')
          .eq('user_id', row.last_updated_by)
          .maybeSingle()
        name = (pref as any)?.full_name ?? null
      }
      setUpdaterName(name)
    } else {
      setUpdaterName(null)
    }

    setLoading(false)
  }, [params.id])

  useEffect(() => { void reload() }, [reload])

  // Live-refresh when the row changes (any tab).
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`case-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_cards', filter: `id=eq.${params.id}` },
        () => { void reload() }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [params.id, reload])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }
  if (!c) {
    return (
      <div className="p-10 text-center text-sm text-gray-500" dir={isAr ? 'rtl' : 'ltr'}>
        {isAr ? 'الحالة غير موجودة' : 'Case not found'}
      </div>
    )
  }

  const badge = STATUS_COLOR[c.status as keyof typeof STATUS_COLOR]
    || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const closed = isClosedStatus(c.status)

  return (
    <div className="max-w-5xl mx-auto space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <ClipboardList className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {c.job_card_number}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                {c.status}
              </span>
              {closed && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isAr ? 'مغلقة' : 'Closed'}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {isAr ? 'النوع:' : 'Type:'} {c.type === 'accident' ? (isAr ? 'حوادث' : 'Accident') : (isAr ? 'ميكانيكي' : 'Mechanical')}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/job-cards"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAr ? 'كل الحالات' : 'All cases'}
        </Link>
      </div>

      {/* Last-updated-by banner — shown prominently under the header so
          it's immediately clear who last changed the case. */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 to-white dark:from-slate-900 dark:to-slate-900">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
            <UserCircle className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {isAr ? 'آخر تحديث بواسطة' : 'Last updated by'}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {updaterName || (isAr ? '— غير معروف —' : '— Unknown —')}
            </span>
          </div>
        </div>
        <span className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {isAr ? 'تاريخ آخر تحديث' : 'Last update time'}
            </span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">
              {fmtDateTime(c.last_updated_at) || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vehicle */}
        <InfoBlock title={isAr ? 'المركبة' : 'Vehicle'} icon={<Car className="w-4 h-4" />}>
          <Row k={isAr ? 'اللوحة' : 'Plate'} v={c.vehicle?.plate_number ?? '—'} />
          <Row k={isAr ? 'الشاسيه' : 'Chassis'} v={c.vehicle?.chassis_number ?? '—'} />
          <Row k={isAr ? 'الماركة' : 'Brand'} v={[c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ') || '—'} />
          <Row k={isAr ? 'المشروع' : 'Project'} v={c.vehicle?.project_code ?? '—'} />
        </InfoBlock>

        {/* Workshop */}
        <InfoBlock title={isAr ? 'الورشة' : 'Workshop'} icon={<Wrench className="w-4 h-4" />}>
          <Row k={isAr ? 'الاسم' : 'Name'} v={c.workshop_name ?? '—'} />
          <Row k={isAr ? 'المدينة' : 'City'} v={c.workshop_city ?? '—'} />
        </InfoBlock>

        {/* Timing */}
        <InfoBlock title={isAr ? 'التواريخ' : 'Timing'} icon={<Calendar className="w-4 h-4" />}>
          <Row k={isAr ? 'تاريخ الاستلام' : 'Received'} v={fmtDateTime(c.received_at)} />
          <Row k={isAr ? 'تاريخ الإغلاق' : 'Completed'} v={fmtDateTime(c.completed_at)} />
          <Row k={isAr ? 'تاريخ التسليم' : 'Delivered'} v={fmtDateTime(c.delivered_at)} />
          <Row k={isAr ? 'آخر تحديث' : 'Last update'} v={fmtDateTime(c.last_updated_at)} />
        </InfoBlock>

        {/* Odometer */}
        <InfoBlock title={isAr ? 'العداد' : 'Odometer'} icon={<Gauge className="w-4 h-4" />}>
          <Row k={isAr ? 'دخول' : 'Entry'} v={`${(c.entry_odometer ?? 0).toLocaleString('en-US')} km`} />
          <Row k={isAr ? 'خروج' : 'Exit'}  v={c.exit_odometer != null ? `${c.exit_odometer.toLocaleString('en-US')} km` : '—'} />
        </InfoBlock>

        {/* Replacement vehicle */}
        <InfoBlock title={isAr ? 'المركبة البديلة' : 'Replacement vehicle'} icon={<Briefcase className="w-4 h-4" />}>
          {alt ? (
            <>
              <Row k={isAr ? 'اللوحة' : 'Plate'} v={alt.plate_number ?? '—'} />
              <Row k={isAr ? 'المركبة' : 'Model'} v={[alt.brand, alt.model].filter(Boolean).join(' ') || '—'} />
            </>
          ) : (
            <p className="text-xs text-gray-500">{isAr ? 'لا توجد مركبة بديلة مرتبطة' : 'No replacement linked'}</p>
          )}
        </InfoBlock>

        {/* Notes */}
        <InfoBlock title={isAr ? 'الملاحظات' : 'Notes'} icon={<StickyNote className="w-4 h-4" />}>
          <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
            {c.complaint_description || (isAr ? '— لا شكوى —' : '— no complaint —')}
          </p>
          {c.internal_notes && (
            <p className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 whitespace-pre-line">
              <span className="font-semibold">{isAr ? 'داخلية: ' : 'Internal: '}</span>
              {c.internal_notes}
            </p>
          )}
        </InfoBlock>
      </div>

      {/* Update form */}
      {!closed && (
        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            {isAr ? 'إضافة تحديث' : 'Add update'}
          </h2>
          <CaseUpdateForm
            caseId={c.id}
            currentStatus={c.status}
            isAr={isAr}
            onSaved={() => { void reload(); setTimelineKey(k => k + 1) }}
          />
        </section>
      )}

      {/* Timeline */}
      <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          {isAr ? 'سجل التحديثات' : 'Update timeline'}
        </h2>
        <CaseTimeline key={timelineKey} caseId={c.id} language={isAr ? 'ar' : 'en'} />
      </section>
    </div>
  )
}

// ─── tiny building blocks ───
function InfoBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
        <span className="text-red-600">{icon}</span>{title}
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-gray-500 min-w-[90px]">{k}</span>
      <span className="text-gray-800 dark:text-gray-200 font-mono break-all">{v}</span>
    </div>
  )
}

