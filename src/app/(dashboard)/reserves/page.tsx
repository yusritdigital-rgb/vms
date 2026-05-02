'use client'

// =====================================================
// Maintenance Appointments — list page (/reserves)
// -----------------------------------------------------
// The old "Protected Reserves (المحميات)" page has been removed
// entirely from the new system. This route now serves the
// Appointments module directly.
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, CalendarClock, CalendarDays, Loader2, Search, Pencil, Trash2,
  User, Car, Phone, Mail, Clock, Timer, CheckCircle2, XCircle, Ban, Eye,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { usePermissions } from '@/hooks/usePermissions'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import {
  type Appointment,
  type AppointmentStatus,
  type AppointmentType,
  STATUS_BADGE_CLASS,
  STATUS_LABEL_AR,
  TYPE_LABEL_AR,
  formatAppointmentSummaryAr,
  formatCountdownAr,
  normaliseTime,
} from '@/lib/appointments/types'
import { toast } from '@/components/ui/Toast'

export default function AppointmentsListPage() {
  const { language } = useTranslation()
  const { isAdmin } = usePermissions()
  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
    if (error) {
      console.error('Load appointments:', error)
      setRows([])
    } else {
      setRows((data as Appointment[]) ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSaved = (_apt: Appointment) => {
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموعد؟')) return
    const supabase = createClient()
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('تم حذف الموعد')
    load()
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r =>
      [r.appointment_number, r.customer_name, r.customer_phone, r.vehicle_plate, r.vehicle_label, r.complaint]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(needle))
    )
  }, [rows, q])

  // Re-render every 60s so the countdown on each card stays fresh.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  /**
   * Mutate an appointment's status inline (no modal). Used by the
   * attendance quick-action buttons on each card.
   *
   * `checked_in` / `no_show` also stamp `attendance_marked_at` so we
   * can later tell when attendance was recorded vs when the appointment
   * was originally created.
   */
  const updateStatus = async (a: Appointment, status: AppointmentStatus) => {
    const supabase = createClient()
    const patch: Record<string, any> = { status }
    if (status === 'checked_in' || status === 'no_show') {
      patch.attendance_marked_at = new Date().toISOString()
    }
    // Optimistic update.
    setRows(prev => prev.map(r => r.id === a.id ? { ...r, ...patch } as Appointment : r))
    const { error } = await supabase.from('appointments').update(patch).eq('id', a.id)
    if (error) {
      console.error('[appointments] status update failed', error)
      toast.error(`تعذر تحديث الحالة: ${error.message}`)
      load()  // roll back by refetching
      return
    }
    toast.success(`تم تحديث الحالة: ${STATUS_LABEL_AR[status]}`)
  }

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">المواعيد</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            إدارة وجدولة مواعيد الصيانة
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 inline-flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          موعد جديد
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState onCreate={() => { setEditing(null); setModalOpen(true) }} />
      ) : (
        <>
          {/* Search */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث بالاسم، رقم اللوحة، رقم الموعد..."
                className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Card grid */}
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl py-10 text-center text-gray-400">
              لا توجد نتائج
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(a => (
                <AppointmentCard
                  key={a.id}
                  a={a}
                  isAdmin={isAdmin}
                  onEdit={() => { setEditing(a); setModalOpen(true) }}
                  onDelete={() => handleDelete(a.id)}
                  onStatus={(s: AppointmentStatus) => updateStatus(a, s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={handleSaved}
        existing={editing}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AppointmentCard
// ---------------------------------------------------------------------------
// Single appointment rendered as a card. Shows everything the user asked for
// (customer, vehicle, type, date/time, live countdown, status) and exposes
// attendance quick-actions (حضر / لم يحضر) plus a few extra transitions
// (معاينة / إلغاء) for operational convenience.
// ═══════════════════════════════════════════════════════════════════════════
function AppointmentCard({
  a, isAdmin, onEdit, onDelete, onStatus,
}: {
  a: Appointment
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onStatus: (s: AppointmentStatus) => void
}) {
  const d = a.scheduled_date ? new Date(a.scheduled_date + 'T00:00:00') : null
  const time = normaliseTime(a.scheduled_time)
  const cd = formatCountdownAr(a.scheduled_date, time)
  const aptType = (a.appointment_type ?? 'maintenance') as AppointmentType

  // Countdown tone: red if past due and appointment still pending,
  // amber if due within 24h, slate otherwise / after attendance recorded.
  const cdNeutral = a.status !== 'scheduled'
  const cdTone = cdNeutral
    ? 'text-gray-400'
    : cd.isPastDue
      ? 'text-red-600 dark:text-red-400'
      : Math.abs(cd.deltaMs) < 24 * 60 * 60 * 1000
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Header: number + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-gray-400">{a.appointment_number}</p>
          <h3 className="font-bold text-gray-900 dark:text-white truncate mt-0.5 flex items-center gap-2">
            <User className="w-4 h-4 text-red-500 shrink-0" />
            {a.customer_name}
          </h3>
          {a.customer_phone && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {a.customer_phone}
            </p>
          )}
          {a.customer_email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1" dir="ltr">
              <Mail className="w-3 h-3" /> {a.customer_email}
            </p>
          )}
        </div>
        <span className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[a.status]}`}>
          {STATUS_LABEL_AR[a.status]}
        </span>
      </div>

      {/* Vehicle + type row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 min-w-0">
          <Car className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate">
            <strong className="text-gray-800 dark:text-gray-200">{a.vehicle_plate || '—'}</strong>
            {a.vehicle_label && <span className="text-gray-400"> · {a.vehicle_label}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
            {TYPE_LABEL_AR[aptType]}
          </span>
        </div>
      </div>

      {/* Date/time + countdown */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-w-0">
          <Clock className="w-4 h-4 text-red-500 shrink-0" />
          <span className="truncate">{formatAppointmentSummaryAr(d, time)}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${cdTone} whitespace-nowrap`}>
          <Timer className="w-3.5 h-3.5" />
          {cd.label}
        </div>
      </div>

      {a.complaint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {a.complaint}
        </p>
      )}

      {/* Attendance quick-actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-slate-800">
        <ActionBtn
          label="حضر"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          tone="emerald"
          active={a.status === 'checked_in'}
          onClick={() => onStatus('checked_in')}
        />
        <ActionBtn
          label="لم يحضر"
          icon={<XCircle className="w-3.5 h-3.5" />}
          tone="red"
          active={a.status === 'no_show'}
          onClick={() => onStatus('no_show')}
        />
        <ActionBtn
          label="تمت المعاينة"
          icon={<Eye className="w-3.5 h-3.5" />}
          tone="purple"
          active={a.status === 'inspected'}
          onClick={() => onStatus('inspected')}
        />
        <ActionBtn
          label="إلغاء"
          icon={<Ban className="w-3.5 h-3.5" />}
          tone="gray"
          active={a.status === 'cancelled'}
          onClick={() => onStatus('cancelled')}
        />
        <div className="flex-1" />
        {/* Edit button: only available for non-completed appointments or for admins */}
        {(a.status === 'scheduled' || isAdmin) && (
          <button
            onClick={onEdit}
            title="تعديل"
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Delete button: admin only */}
        {isAdmin && (
          <button
            onClick={onDelete}
            title="حذف"
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  label, icon, onClick, active, tone,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active: boolean
  tone: 'emerald' | 'red' | 'purple' | 'gray'
}) {
  const tones: Record<typeof tone, { active: string; idle: string }> = {
    emerald: { active: 'bg-emerald-600 text-white border-emerald-600', idle: 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' },
    red:     { active: 'bg-red-600 text-white border-red-600',         idle: 'text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20' },
    purple:  { active: 'bg-purple-600 text-white border-purple-600',   idle: 'text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20' },
    gray:    { active: 'bg-gray-700 text-white border-gray-700',       idle: 'text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800' },
  }
  const cls = active ? tones[tone].active : tones[tone].idle
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-colors ${cls}`}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 flex items-center justify-center mb-4">
        <CalendarClock className="w-7 h-7" />
      </div>
      <p className="text-gray-600 dark:text-gray-300 font-medium mb-4">لا توجد مواعيد مسجلة</p>
      <button
        onClick={onCreate}
        className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 inline-flex items-center gap-2"
      >
        <CalendarDays className="w-4 h-4" />
        إنشاء موعد
      </button>
    </div>
  )
}
