// =====================================================
// Dashboard Excel exports
// -----------------------------------------------------
// Three .xlsx exports wired into the dashboard header:
//   • Open cases       (الحالات المفتوحة)
//   • Closed cases     (الحالات المغلقة)
//   • Appointments     (المواعيد)
//
// Data must always match what the dashboard shows live, so each
// export pulls fresh rows from the same DB source the dashboard
// uses (job_cards / appointments) and then maps to clean Arabic
// columns. Built on top of the existing `exportSingleSheet` helper
// in @/lib/utils/excelExport.
// =====================================================

import { createClient } from '@/lib/supabase/client'
import { listOpenCases, listClosedCases, logPgError } from '@/lib/cases/queries'
import { exportSingleSheet } from '@/lib/utils/excelExport'
import type { CaseRow } from '@/lib/cases/types'
import { STATUS_LABEL_AR, TYPE_LABEL_AR, type Appointment, normaliseTime } from '@/lib/appointments/types'

// Embed exposed by CASE_SELECT but not on CaseRow type — typed locally.
type CaseRowWithReplacement = CaseRow & {
  replacement_vehicle: { plate_number: string | null } | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // Use English numerals as required.
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function vehicleType(c: CaseRow): string {
  const v = c.vehicle
  if (!v) return ''
  return [v.brand, v.model].filter(Boolean).join(' ').trim()
}

// ─── Open cases ─────────────────────────────────────────
export async function exportOpenCasesExcel(): Promise<void> {
  const rows = (await listOpenCases()) as CaseRowWithReplacement[]
  const data = rows.map(c => ({
    case_number:    c.job_card_number,
    plate:          c.vehicle?.plate_number ?? '',
    vehicle_type:   vehicleType(c),
    project:        c.vehicle?.project_code ?? '',
    workshop:       [c.workshop_name, c.workshop_city].filter(Boolean).join(' — '),
    status:         c.status,
    received_at:    fmtDate(c.received_at),
    last_updated:   fmtDate(c.last_updated_at ?? c.received_at),
    replacement:    c.replacement_vehicle?.plate_number ?? '',
  }))

  await exportSingleSheet(
    'الحالات المفتوحة',
    [
      { header: 'رقم الحالة',     key: 'case_number',  width: 18 },
      { header: 'رقم اللوحة',     key: 'plate',        width: 16 },
      { header: 'نوع المركبة',    key: 'vehicle_type', width: 24 },
      { header: 'المشروع',        key: 'project',      width: 14 },
      { header: 'الورشة',         key: 'workshop',     width: 28 },
      { header: 'الحالة',         key: 'status',       width: 26 },
      { header: 'تاريخ الدخول',   key: 'received_at',  width: 20 },
      { header: 'آخر تحديث',     key: 'last_updated', width: 20 },
      { header: 'البديلة',        key: 'replacement',  width: 16 },
    ],
    data,
    'open_cases',
    { noSummary: true },
  )
}

// ─── Closed cases ───────────────────────────────────────
export async function exportClosedCasesExcel(): Promise<void> {
  const rows = (await listClosedCases()) as CaseRowWithReplacement[]
  const data = rows.map(c => ({
    case_number:   c.job_card_number,
    plate:         c.vehicle?.plate_number ?? '',
    vehicle_type:  vehicleType(c),
    project:       c.vehicle?.project_code ?? '',
    workshop:      [c.workshop_name, c.workshop_city].filter(Boolean).join(' — '),
    status:        c.status,
    received_at:   fmtDate(c.received_at),
    completed_at:  fmtDate(c.completed_at ?? c.delivered_at),
    closure_type:  c.closure_type ?? '',
  }))

  await exportSingleSheet(
    'الحالات المغلقة',
    [
      { header: 'رقم الحالة',     key: 'case_number',  width: 18 },
      { header: 'رقم اللوحة',     key: 'plate',        width: 16 },
      { header: 'نوع المركبة',    key: 'vehicle_type', width: 24 },
      { header: 'المشروع',        key: 'project',      width: 14 },
      { header: 'الورشة',         key: 'workshop',     width: 28 },
      { header: 'الحالة',         key: 'status',       width: 26 },
      { header: 'تاريخ الدخول',   key: 'received_at',  width: 20 },
      { header: 'تاريخ الإغلاق',  key: 'completed_at', width: 20 },
      { header: 'نوع الإغلاق',    key: 'closure_type', width: 16 },
    ],
    data,
    'closed_cases',
    { noSummary: true },
  )
}

// ─── Appointments ───────────────────────────────────────
export async function exportAppointmentsExcel(): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false })
    .limit(5000)
  if (error) {
    logPgError('[dashboard/exports] appointments load failed', error)
    return
  }
  const rows = ((data as Appointment[]) ?? []).map(a => ({
    number:        a.appointment_number,
    customer:      a.customer_name,
    phone:         a.customer_phone ?? '',
    plate:         a.vehicle_plate ?? '',
    vehicle:       a.vehicle_label ?? '',
    type:          a.appointment_type ? (TYPE_LABEL_AR[a.appointment_type] ?? a.appointment_type) : '',
    date:          a.scheduled_date,
    time:          normaliseTime(a.scheduled_time),
    status:        STATUS_LABEL_AR[a.status] ?? a.status,
    attendance:    fmtDate(a.attendance_marked_at),
  }))

  await exportSingleSheet(
    'المواعيد',
    [
      { header: 'رقم الموعد',      key: 'number',     width: 16 },
      { header: 'اسم العميل',      key: 'customer',   width: 22 },
      { header: 'رقم الجوال',      key: 'phone',      width: 16 },
      { header: 'رقم اللوحة',      key: 'plate',      width: 14 },
      { header: 'المركبة',         key: 'vehicle',    width: 22 },
      { header: 'نوع الموعد',      key: 'type',       width: 14 },
      { header: 'التاريخ',         key: 'date',       width: 14 },
      { header: 'الوقت',           key: 'time',       width: 10 },
      { header: 'الحالة',          key: 'status',     width: 18 },
      { header: 'وقت الحضور',      key: 'attendance', width: 20 },
    ],
    rows,
    'appointments',
    { noSummary: true },
  )
}
