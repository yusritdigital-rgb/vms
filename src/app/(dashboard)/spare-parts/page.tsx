'use client'

// =====================================================
// Alternatives (البدائل) — /spare-parts
// -----------------------------------------------------
// The sidebar label is "البدائل / Alternatives". This page drives the
// RV replacement-vehicle pool:
//   Tab 1 — البدائل الشاغرة : RV vehicles not currently issued to any
//           open case.
//   Tab 2 — البدائل المصروفة: RV vehicles linked as `replacement_vehicle_id`
//           on a case whose status is NOT in the closed set.
//
// Data source: `vehicles` rows where `project_code` starts with "RV"
// (see `@/lib/alternatives/rules`). No new tables are introduced; we
// just re-use the existing `replacement_vehicle_id` column added by
// migration 009.
//
// Route stays `/spare-parts` on purpose — the sidebar entry already
// links here and the access-matrix section `alternatives` already
// maps to this route. Only the page content was swapped.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { Repeat, Car, CheckCircle, Search, Loader2, ExternalLink } from 'lucide-react'
import {
  useAllVehicles,
  type VehicleLite,
} from '@/hooks/useAllVehicles'
import { isRvProjectCode } from '@/lib/alternatives/rules'
import { CLOSED_STATUSES } from '@/lib/cases/statuses'

/** Case row pulled for each RV vehicle currently issued. */
interface IssuedCaseLite {
  id: string
  job_card_number: string | null
  status: string | null
  replacement_vehicle_id: string | null
}

type Tab = 'available' | 'issued'

export default function AlternativesPage() {
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const { vehicles, loading: loadingVehicles } = useAllVehicles()

  const [issued, setIssued] = useState<IssuedCaseLite[]>([])
  const [loadingIssued, setLoadingIssued] = useState(true)

  const [tab, setTab] = useState<Tab>('available')
  const [q, setQ] = useState('')

  // Load open cases that hold a replacement vehicle. We intentionally keep
  // the query simple and filter client-side by "not in CLOSED_STATUSES" so
  // free-text Arabic statuses continue to work without DB surgery.
  const loadIssued = async () => {
    setLoadingIssued(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('job_cards')
      .select('id, job_card_number, status, replacement_vehicle_id')
      .not('replacement_vehicle_id', 'is', null)
    const rows = ((data as IssuedCaseLite[]) ?? []).filter(
      r => !(CLOSED_STATUSES as readonly string[]).includes(r.status ?? '')
    )
    setIssued(rows)
    setLoadingIssued(false)
  }

  useEffect(() => { loadIssued() }, [])

  // Live refresh — when a case is closed (or its replacement_vehicle_id
  // is otherwise nulled), the vehicle must flip from "issued" back to
  // "available" without a page reload. We listen to any change on
  // `job_cards` and re-pull the issued set.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('vms:alternatives:issued')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_cards' },
        () => loadIssued()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // RV vehicles = project_code starts with "RV" (case-insensitive).
  const rvVehicles = useMemo(
    () => vehicles.filter(v => isRvProjectCode(v.project_code)),
    [vehicles]
  )

  const issuedByVehicleId = useMemo(() => {
    const m = new Map<string, IssuedCaseLite>()
    for (const c of issued) {
      if (c.replacement_vehicle_id) m.set(c.replacement_vehicle_id, c)
    }
    return m
  }, [issued])

  const available = useMemo(
    () => rvVehicles.filter(v => !issuedByVehicleId.has(v.id)),
    [rvVehicles, issuedByVehicleId]
  )
  const issuedVehicles = useMemo(
    () => rvVehicles.filter(v => issuedByVehicleId.has(v.id)),
    [rvVehicles, issuedByVehicleId]
  )

  // Client search on either tab — matches plate/chassis/brand/model/project.
  const needle = q.trim().toLowerCase()
  const match = (v: VehicleLite) => {
    if (!needle) return true
    const hay = [
      v.plate_number, v.plate_number_ar, v.chassis_number,
      v.brand, v.manufacturer, v.model, v.project_code,
    ].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(needle)
  }
  const availableFiltered = available.filter(match)
  const issuedFiltered = issuedVehicles.filter(match)

  const loading = loadingVehicles || loadingIssued

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Repeat className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isAr ? 'البدائل' : 'Alternatives'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isAr
                ? 'مركبات مشروع RV المستخدمة كمركبات بديلة'
                : 'RV project vehicles used as replacements'}
            </p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
            {isAr ? 'الشاغرة' : 'Available'}: <strong>{available.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
            {isAr ? 'المصروفة' : 'Issued'}: <strong>{issuedVehicles.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-medium">
            {isAr ? 'الإجمالي' : 'Total RV'}: <strong>{rvVehicles.length}</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 p-2 border-b border-gray-100 dark:border-slate-800">
          <TabButton
            active={tab === 'available'}
            onClick={() => setTab('available')}
            label={isAr ? 'البدائل الشاغرة' : 'Available Alternatives'}
            count={available.length}
          />
          <TabButton
            active={tab === 'issued'}
            onClick={() => setTab('issued')}
            label={isAr ? 'البدائل المصروفة' : 'Issued Alternatives'}
            count={issuedVehicles.length}
          />
          <div className="flex-1" />
          <div className="relative w-64 max-w-full">
            <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? 'بحث (لوحة، شاسيه، موديل...)' : 'Search (plate, chassis, model...)'}
              className="w-full ps-9 pe-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin inline-block" />
          </div>
        ) : tab === 'available' ? (
          <AvailableTable rows={availableFiltered} isAr={isAr} emptyTotal={rvVehicles.length === 0} />
        ) : (
          <IssuedTable
            rows={issuedFiltered}
            issuedByVehicleId={issuedByVehicleId}
            isAr={isAr}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

function TabButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors
        ${active
          ? 'bg-red-600 text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
    >
      {label}
      <span className={`ms-2 text-xs px-2 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-gray-100 dark:bg-slate-800'}`}>
        {count}
      </span>
    </button>
  )
}

function AvailableTable({
  rows, isAr, emptyTotal,
}: { rows: VehicleLite[]; isAr: boolean; emptyTotal: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="w-7 h-7" />}
        title={emptyTotal
          ? (isAr ? 'لا توجد مركبات في مشروع RV' : 'No RV vehicles in the system')
          : (isAr ? 'لا توجد بدائل شاغرة حالياً' : 'No available alternatives right now')}
        hint={emptyTotal
          ? (isAr ? 'ستظهر المركبات هنا بعد استيرادها بكود مشروع يبدأ بـ RV.' : 'Vehicles whose project_code starts with "RV" will show up here after import.')
          : (isAr ? 'جميع بدائل RV مصروفة لحالات مفتوحة.' : 'All RV alternatives are currently issued to open cases.')}
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-slate-800 text-xs uppercase text-gray-500 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3 text-start">{isAr ? 'اللوحة' : 'Plate'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'الشاسيه' : 'Chassis'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'الماركة والموديل' : 'Brand & Model'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'كود المشروع' : 'Project Code'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map(v => (
            <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                {v.plate_number || v.plate_number_ar || '—'}
                {v.plate_number_ar && v.plate_number && (
                  <span className="ms-2 text-xs text-gray-400" dir="rtl">{v.plate_number_ar}</span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{v.chassis_number || '—'}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                {[v.brand || v.manufacturer, v.model].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-mono">{v.project_code || '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IssuedTable({
  rows, issuedByVehicleId, isAr,
}: { rows: VehicleLite[]; issuedByVehicleId: Map<string, IssuedCaseLite>; isAr: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Car className="w-7 h-7" />}
        title={isAr ? 'لا توجد بدائل مصروفة' : 'No issued alternatives'}
        hint={isAr ? 'عند ربط مركبة RV كبديلة في حالة مفتوحة ستظهر هنا.' : 'Link an RV vehicle as a replacement on an open case and it will appear here.'}
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-slate-800 text-xs uppercase text-gray-500 dark:text-gray-400">
          <tr>
            <th className="px-4 py-3 text-start">{isAr ? 'اللوحة' : 'Plate'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'الماركة والموديل' : 'Brand & Model'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'الحالة المرتبطة' : 'Linked Case'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'حالة الحالة' : 'Case Status'}</th>
            <th className="px-4 py-3 text-start">{isAr ? 'إجراء' : 'Action'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {rows.map(v => {
            const c = issuedByVehicleId.get(v.id)!
            return (
              <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                  {v.plate_number || v.plate_number_ar || '—'}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {[v.brand || v.manufacturer, v.model].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                  {c.job_card_number || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs">
                    {c.status || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/job-cards/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {isAr ? 'فتح الحالة' : 'Open case'}
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({
  icon, title, hint,
}: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-gray-700 dark:text-gray-200 font-medium">{title}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-md">{hint}</p>
    </div>
  )
}
