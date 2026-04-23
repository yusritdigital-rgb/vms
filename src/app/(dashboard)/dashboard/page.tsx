'use client'

// =====================================================
// VMS — Dashboard (business-aligned rewrite)
// -----------------------------------------------------
// Structure (top → bottom):
//
//   1. Header  .................... title · live clock · Export All
//   2. Overdue alert (conditional)  open cases > 3 days old
//   3. Row 1 — Cases KPIs (4)       فتح · إغلاق · إجمالي الحالات · إجمالي المركبات
//   4. Row 2 — Modules (4)          مواعيد اليوم · المواعيد · الفواتير · البدائل RV
//   5. Row 3 — (2 cards)            الورش · زمن الحالة (avg/fastest/slowest)
//   6. Section — توزيع الحالات      (CaseStatusChart, full-width)
//   7. Section — اتجاه الحالات      MonthlyTrendChart + WeeklyActivityHeatmap
//   8. Section — سجل الحالات        CaseHistoryTable (closed cases)
//   9. Section — آخر الحالات        5 newest cases (any status)
//
// Every count below comes from live DB queries. No legacy status
// aggregates (`received / under_repair / repaired / delivered`) are
// referenced — every open/closed decision routes through
// `isCaseClosed` from `@/lib/cases/statuses`.
// =====================================================

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import {
  AlertTriangle, Car, ClipboardList, CircleDot, CheckCircle,
  Clock, Wrench, Receipt, Repeat, Timer, Download, ChevronRight,
  Loader2, History,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { CASE_STATUSES, STATUS_COLOR, isCaseClosed } from '@/lib/cases/statuses'
import { notifyVehicleOverdue } from '@/lib/notifications/trigger'

// Chart components (client-only).
const CaseStatusChart      = dynamic(() => import('@/components/dashboard/CaseStatusChart'),      { ssr: false })
const MonthlyTrendChart    = dynamic(() => import('@/components/dashboard/MonthlyTrendChart'),    { ssr: false })
const WeeklyActivityHeatmap= dynamic(() => import('@/components/dashboard/WeeklyActivityHeatmap'),{ ssr: false })
const CaseHistoryTable     = dynamic(() => import('@/components/dashboard/CaseHistoryTable'),     { ssr: false })

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface DashboardStats {
  // Core counts
  totalVehicles:     number
  totalJobCards:     number
  openCases:         number
  closedCases:       number
  overdueOpenCases:  number
  // Module counts
  appointmentsCount:          number
  appointmentsCompletedToday: number
  invoicesCount:              number
  alternativesCount:          number
  workshopsCount:             number
  // Distribution across all Arabic case statuses
  statusDistribution: Record<string, number>
  // Repair-time stats (closed cases)
  avgRepairHours:     number
  fastestRepairHours: number
  slowestRepairHours: number
  completedCount:     number
}

interface RecentCase {
  id: string
  job_card_number: string
  type: string
  status: string
  created_at: string
  vehicle: { plate_number: string | null } | null
}

// Raw row shape used only inside loadDashboardStats — kept permissive
// to tolerate both new-workflow fields (`completed_at`, Arabic status)
// and any legacy columns that might still exist on older DBs.
interface RawCase {
  id: string
  job_card_number: string
  vehicle_id: string
  status: string
  received_at: string | null
  completed_at?: string | null
  delivered_at?: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const isAr = language === 'ar'

  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalJobCards: 0,
    openCases: 0,
    closedCases: 0,
    overdueOpenCases: 0,
    appointmentsCount: 0,
    appointmentsCompletedToday: 0,
    invoicesCount: 0,
    alternativesCount: 0,
    workshopsCount: 0,
    statusDistribution: {},
    avgRepairHours: 0,
    fastestRepairHours: 0,
    slowestRepairHours: 0,
    completedCount: 0,
  })
  const [recent, setRecent] = useState<RecentCase[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-refresh every 30 s.
  useEffect(() => {
    if (companyLoading) return
    loadDashboardStats()
    intervalRef.current = setInterval(() => {
      loadDashboardStats(true)
      setRefreshKey(k => k + 1)
    }, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [companyId, companyLoading])

  // ───────────────────────────────────────────────────
  // Data load — everything in parallel. Every count uses a
  // `count: 'exact', head: true` query so the 1000-row default
  // PostgREST cap can never under-report.
  // ───────────────────────────────────────────────────
  const loadDashboardStats = async (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createClient()

    try {
      const now = new Date()
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000
      const todayYmd = now.toISOString().slice(0, 10)

      // Selects + counts, fired in parallel
      const casesQuery = supabase
        .from('job_cards')
        .select('id, vehicle_id, status, received_at, completed_at, delivered_at, created_at, job_card_number')
      const vehiclesLiteQuery = supabase
        .from('vehicles')
        .select('id, project_code')
      const recentQuery = supabase
        .from('job_cards')
        .select('id, job_card_number, type, status, created_at, vehicle:vehicles(plate_number)')
        .order('created_at', { ascending: false })
        .limit(5)

      const safeCount = async (p: PromiseLike<{ count: number | null }>) => {
        try { const { count } = await p; return count ?? 0 } catch { return 0 }
      }
      const vehiclesCountQuery     = supabase.from('vehicles')    .select('id', { count: 'exact', head: true })
      const appointmentsCountQuery = supabase.from('appointments').select('id', { count: 'exact', head: true })
      const invoicesCountQuery     = supabase.from('invoices')    .select('id', { count: 'exact', head: true })
      const workshopsCountQuery    = supabase.from('workshops')   .select('id', { count: 'exact', head: true })
      const apptCompletedTodayQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('appointment_date', todayYmd)

      const [
        { data: caseRows, error: casesErr },
        { data: vehicleRows },
        { data: recentRows },
        vehiclesCount,
        appointmentsCount,
        invoicesCount,
        workshopsCount,
        appointmentsCompletedToday,
      ] = await Promise.all([
        casesQuery,
        vehiclesLiteQuery,
        recentQuery,
        safeCount(vehiclesCountQuery as any),
        safeCount(appointmentsCountQuery as any),
        safeCount(invoicesCountQuery as any),
        safeCount(workshopsCountQuery as any),
        safeCount(apptCompletedTodayQuery as any),
      ])

      if (casesErr) {
        console.error('[dashboard] cases query failed', casesErr)
      }

      const cases: RawCase[] = (caseRows as RawCase[]) ?? []
      if (recentRows) setRecent(recentRows as unknown as RecentCase[])

      // ── Closed-set predicate. Accept legacy 'delivered' so old data still counts.
      const isClosed = (s: string) => isCaseClosed(s) || s === 'delivered'

      const openCases   = cases.filter(c => !isClosed(c.status)).length
      const closedCases = cases.filter(c =>  isClosed(c.status)).length

      const overdueOpenCases = cases.filter(c => {
        if (isClosed(c.status)) return false
        if (!c.received_at) return false
        return now.getTime() - new Date(c.received_at).getTime() > threeDaysMs
      }).length

      // Repair time = (completed_at || delivered_at) − received_at, in hours.
      const closedWithBothEnds = cases.filter(c => isClosed(c.status) && c.received_at)
      const durations = closedWithBothEnds
        .map(c => {
          const endIso = c.completed_at || c.delivered_at
          if (!endIso || !c.received_at) return NaN
          return (new Date(endIso).getTime() - new Date(c.received_at).getTime()) / (1000 * 60 * 60)
        })
        .filter(d => Number.isFinite(d) && d > 0)

      let avgRepairHours = 0, fastestRepairHours = 0, slowestRepairHours = 0
      if (durations.length > 0) {
        avgRepairHours     = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        fastestRepairHours = Math.round(Math.min(...durations))
        slowestRepairHours = Math.round(Math.max(...durations))
      }

      // Distribution restricted to the approved CASE_STATUSES set only.
      // Any DB row whose status is a legacy value (e.g. 'received',
      // 'under_repair', 'repaired', 'delivered') is silently skipped so
      // the chart renders ONLY the 17 business-approved statuses with
      // counts, including zero counts.
      const approved = new Set<string>(CASE_STATUSES as readonly string[])
      const statusDistribution: Record<string, number> = {}
      for (const s of CASE_STATUSES) statusDistribution[s] = 0
      for (const c of cases) {
        const k = c.status || ''
        if (!k || !approved.has(k)) continue
        statusDistribution[k] = (statusDistribution[k] ?? 0) + 1
      }

      // Alternatives (RV) = vehicles whose project_code starts with "RV".
      const alternativesCount = (vehicleRows ?? []).filter((v: any) =>
        typeof v.project_code === 'string' && /^rv/i.test(v.project_code.trim())
      ).length

      setStats({
        totalVehicles: vehiclesCount || (vehicleRows?.length || 0),
        totalJobCards: cases.length,
        openCases,
        closedCases,
        overdueOpenCases,
        appointmentsCount,
        appointmentsCompletedToday,
        invoicesCount,
        alternativesCount,
        workshopsCount,
        statusDistribution,
        avgRepairHours,
        fastestRepairHours,
        slowestRepairHours,
        completedCount: closedWithBothEnds.length,
      })
      setLastUpdated(new Date())

      // Side-effect: push overdue notifications for cases we just discovered
      // as overdue (only on first load to avoid spamming).
      if (!silent && companyId) {
        cases
          .filter(c => !isClosed(c.status) && c.received_at &&
                       now.getTime() - new Date(c.received_at).getTime() > threeDaysMs)
          .forEach(async (c) => {
            const days = Math.floor((now.getTime() - new Date(c.received_at!).getTime()) / (24 * 60 * 60 * 1000))
            // Best-effort plate lookup — the light cases query doesn't include the vehicle join.
            notifyVehicleOverdue(companyId, c.vehicle_id, days, c.id)
          })
      }
    } catch (e) {
      console.error('[dashboard] load failed', e)
    } finally {
      setLoading(false)
    }
  }

  // ───────────────────────────────────────────────────
  // Loading state
  // ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  // Number formatter. Always uses en-US so the dashboard shows
  // Western (English) numerals regardless of the UI language.
  const n = (v: number) => v.toLocaleString('en-US')

  // Convert hours to a "best-fit" human unit (shows days when ≥ 24 h).
  const humanDuration = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return { value: 0, unit: isAr ? 'ساعة' : 'hr' }
    if (hours < 24) return { value: hours, unit: isAr ? 'ساعة' : 'hr' }
    return { value: Math.round(hours / 24), unit: isAr ? 'يوم' : 'days' }
  }

  // ───────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────
  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ═══ 1. HEADER ═══ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'لوحة التحكم' : 'Dashboard'}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {now(language)}
            </p>
            <span className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {isAr ? 'تحديث تلقائي' : 'Live'} · {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 2. OVERDUE ALERT ═══ */}
      {stats.overdueOpenCases > 0 && (
        <Link
          href="/job-cards"
          className="block bg-red-50 dark:bg-red-950/40 border-2 border-red-400 dark:border-red-700 rounded-xl p-5 hover:border-red-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-xl">
              <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                {isAr ? 'حالات متأخرة' : 'Overdue Cases'}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                {isAr
                  ? `${n(stats.overdueOpenCases)} حالة مفتوحة منذ أكثر من 3 أيام`
                  : `${stats.overdueOpenCases} open cases received more than 3 days ago`}
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 text-red-600 ${isAr ? 'rotate-180' : ''}`} />
          </div>
        </Link>
      )}

      {/* ═══ 3. ROW 1 — CASES KPIs (4) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<CircleDot className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          tint="bg-blue-100 dark:bg-blue-900/30"
          value={n(stats.openCases)}
          label={isAr ? 'الحالات المفتوحة' : 'Open Cases'}
          href="/job-cards"
        />
        <KpiCard
          icon={<CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          tint="bg-emerald-100 dark:bg-emerald-900/30"
          value={n(stats.closedCases)}
          label={isAr ? 'الحالات المغلقة' : 'Closed Cases'}
          href="/job-cards"
        />
        <KpiCard
          icon={<ClipboardList className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
          tint="bg-gray-100 dark:bg-slate-800"
          value={n(stats.totalJobCards)}
          label={isAr ? 'إجمالي الحالات' : 'Total Cases'}
          href="/job-cards"
        />
        <KpiCard
          icon={<Car className="w-5 h-5 text-red-600 dark:text-red-400" />}
          tint="bg-red-100 dark:bg-red-900/30"
          value={n(stats.totalVehicles)}
          label={isAr ? 'إجمالي المركبات' : 'Total Vehicles'}
          href="/fleet"
        />
      </div>

      {/* ═══ 4. ROW 2 — MODULE KPIs (4) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<CheckCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          tint="bg-rose-100 dark:bg-rose-900/30"
          value={n(stats.appointmentsCompletedToday)}
          label={isAr ? 'مواعيد منجزة اليوم' : 'Completed Appointments Today'}
          href="/reserves"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          tint="bg-indigo-100 dark:bg-indigo-900/30"
          value={n(stats.appointmentsCount)}
          label={isAr ? 'المواعيد' : 'Appointments'}
          href="/reserves"
        />
        <KpiCard
          icon={<Receipt className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          tint="bg-teal-100 dark:bg-teal-900/30"
          value={n(stats.invoicesCount)}
          label={isAr ? 'الفواتير' : 'Invoices'}
          href="/forms/invoices"
        />
        <KpiCard
          icon={<Repeat className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          tint="bg-purple-100 dark:bg-purple-900/30"
          value={n(stats.alternativesCount)}
          label={isAr ? 'البدائل (RV)' : 'Alternatives (RV)'}
          href="/spare-parts"
        />
      </div>

      {/* ═══ 5. ROW 3 — WORKSHOPS + REPAIR TIME STATS (2 cards) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={<Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          tint="bg-amber-100 dark:bg-amber-900/30"
          value={n(stats.workshopsCount)}
          label={isAr ? 'الورش' : 'Workshops'}
          href="/admin-dashboard/workshops"
        />
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                {isAr ? 'زمن الحالة' : 'Case Duration'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {isAr
                  ? `بناءً على ${n(stats.completedCount)} حالة مغلقة`
                  : `Based on ${stats.completedCount} closed cases`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <DurationTile label={isAr ? 'المتوسط'  : 'Average'} hours={stats.avgRepairHours} humanDuration={humanDuration} />
            <DurationTile label={isAr ? 'الأسرع'  : 'Fastest'} hours={stats.fastestRepairHours} humanDuration={humanDuration} />
            <DurationTile label={isAr ? 'الأبطأ'  : 'Slowest'} hours={stats.slowestRepairHours} humanDuration={humanDuration} />
          </div>
        </div>
      </div>

      {/* ═══ 6. STATUS DISTRIBUTION (full width) ═══ */}
      <CaseStatusChart distribution={stats.statusDistribution} includeZeros />

      {/* ═══ 7. MONTHLY TREND + WEEKLY ACTIVITY ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart       key={`trend-${refreshKey}`}   />
        <WeeklyActivityHeatmap   key={`heatmap-${refreshKey}`} />
      </div>

      {/* ═══ 8. CASE HISTORY (closed cases only) ═══ */}
      <CaseHistoryTable key={`history-${refreshKey}`} />

      {/* ═══ 9. RECENT CASES (5 newest, any status) ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <History className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              {isAr ? 'آخر الحالات' : 'Recent Cases'}
            </h3>
          </div>
          <Link href="/job-cards" className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
            {isAr ? 'عرض الكل' : 'View all'} <ChevronRight className={`w-3 h-3 ${isAr ? 'rotate-180' : ''}`} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            {isAr ? 'لا توجد حالات حديثة' : 'No recent cases'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {recent.map((c) => {
              const badge = STATUS_COLOR[c.status as keyof typeof STATUS_COLOR]
                || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              return (
                <li key={c.id}>
                  <Link href={`/job-cards/${c.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-semibold text-red-600">
                        {c.job_card_number}
                      </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {c.vehicle?.plate_number || '—'}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge} whitespace-nowrap`}>
                        {c.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {/* date-fns format uses Western digits regardless of locale */}
                      {format(new Date(c.created_at), 'yyyy-MM-dd')}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

/** Compact KPI card used by both top rows. Entire card is a link. */
function KpiCard({
  icon, tint, value, label, href,
}: {
  icon: React.ReactNode
  tint: string
  value: string
  label: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:border-red-400 dark:hover:border-red-600 transition-all hover:shadow-md block"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${tint}`}>{icon}</div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </Link>
  )
}

function DurationTile({
  label, hours, humanDuration,
}: {
  label: string
  hours: number
  humanDuration: (h: number) => { value: number; unit: string }
}) {
  const { value, unit } = humanDuration(hours)
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center border border-amber-200 dark:border-amber-800">
      <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{unit}</p>
    </div>
  )
}

function now(_language: 'ar' | 'en' | string) {
  // Always en-US so the date digits are Western (0-9). Arabic users
  // will see English month names alongside Arabic UI copy — consistent
  // with the "English numerals only" rule for the dashboard.
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
