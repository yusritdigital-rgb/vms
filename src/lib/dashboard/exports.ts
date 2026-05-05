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
  })
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

function calculateDays(receivedAt: string | null | undefined, completedAt: string | null | undefined): number {
  if (!receivedAt) return 0
  const start = new Date(receivedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
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
    received_date:  fmtDate(c.received_at),
    received_time:  fmtTime(c.received_at),
    last_updated:   fmtDate(c.last_updated_at ?? c.received_at),
    days_count:     calculateDays(c.received_at, null),
    replacement:    c.replacement_vehicle?.plate_number ?? '',
  }))

  await exportSingleSheet(
    'الحالات المفتوحة',
    [
      { header: 'رقم الحالة',     key: 'case_number',    width: 18 },
      { header: 'رقم اللوحة',     key: 'plate',           width: 16 },
      { header: 'نوع المركبة',    key: 'vehicle_type',    width: 24 },
      { header: 'المشروع',        key: 'project',         width: 14 },
      { header: 'الورشة',         key: 'workshop',        width: 28 },
      { header: 'الحالة',         key: 'status',          width: 26 },
      { header: 'تاريخ الدخول',   key: 'received_date',   width: 14 },
      { header: 'وقت الدخول',     key: 'received_time',   width: 12 },
      { header: 'آخر تحديث',     key: 'last_updated',    width: 14 },
      { header: 'عدد الأيام',     key: 'days_count',      width: 12 },
      { header: 'البديلة',        key: 'replacement',     width: 16 },
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
    case_number:    c.job_card_number,
    plate:          c.vehicle?.plate_number ?? '',
    vehicle_type:   vehicleType(c),
    project:        c.vehicle?.project_code ?? '',
    workshop:       [c.workshop_name, c.workshop_city].filter(Boolean).join(' — '),
    status:         c.status,
    received_date:  fmtDate(c.received_at),
    received_time:  fmtTime(c.received_at),
    completed_date: fmtDate(c.completed_at ?? c.delivered_at),
    completed_time: fmtTime(c.completed_at ?? c.delivered_at),
    closure_type:   c.closure_type ?? '',
    days_count:     calculateDays(c.received_at, c.completed_at ?? c.delivered_at),
  }))

  await exportSingleSheet(
    'الحالات المغلقة',
    [
      { header: 'رقم الحالة',     key: 'case_number',    width: 18 },
      { header: 'رقم اللوحة',     key: 'plate',           width: 16 },
      { header: 'نوع المركبة',    key: 'vehicle_type',    width: 24 },
      { header: 'المشروع',        key: 'project',         width: 14 },
      { header: 'الورشة',         key: 'workshop',        width: 28 },
      { header: 'الحالة',         key: 'status',          width: 26 },
      { header: 'تاريخ الدخول',   key: 'received_date',   width: 14 },
      { header: 'وقت الدخول',     key: 'received_time',   width: 12 },
      { header: 'تاريخ الإغلاق',  key: 'completed_date',  width: 14 },
      { header: 'وقت الإغلاق',    key: 'completed_time',  width: 12 },
      { header: 'نوع الإغلاق',    key: 'closure_type',    width: 16 },
      { header: 'عدد الأيام',     key: 'days_count',      width: 12 },
    ],
    data,
    'closed_cases',
    { noSummary: true },
  )
}

// ─── All cases (open + closed) ─────────────────────────────
export async function exportAllCasesExcel(): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_cards')
    .select(`
      id, job_card_number, type, status, closure_type,
      received_at, expected_completion_date, completed_at, delivered_at,
      workshop_id, workshop_name, workshop_city,
      vehicle_id, replacement_vehicle_id,
      replacement_return_odometer, replacement_return_date, replacement_return_notes,
      complaint_description, internal_notes, customer_phone,
      entry_odometer, exit_odometer,
      created_at, last_updated_at, last_updated_by,
      vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, project_code, brand, model, chassis_number),
      replacement_vehicle:vehicles!job_cards_replacement_vehicle_id_fkey(id, plate_number, project_code, brand, model)
    `)
    .order('received_at', { ascending: false })
    .limit(10000)
  if (error) {
    logPgError('[dashboard/exports] all cases load failed', error)
    return
  }

  const rows = ((data as CaseRowWithReplacement[]) ?? []).map(c => ({
    case_number:    c.job_card_number,
    plate:          c.vehicle?.plate_number ?? '',
    vehicle_type:   vehicleType(c),
    project:        c.vehicle?.project_code ?? '',
    workshop:       [c.workshop_name, c.workshop_city].filter(Boolean).join(' — '),
    status:         c.status,
    received_date:  fmtDate(c.received_at),
    received_time:  fmtTime(c.received_at),
    completed_date: fmtDate(c.completed_at ?? c.delivered_at),
    completed_time: fmtTime(c.completed_at ?? c.delivered_at),
    closure_type:   c.closure_type ?? '',
    days_count:     calculateDays(c.received_at, c.completed_at ?? c.delivered_at),
    replacement:    c.replacement_vehicle?.plate_number ?? '',
  }))

  await exportSingleSheet(
    'جميع الحالات',
    [
      { header: 'رقم الحالة',     key: 'case_number',    width: 18 },
      { header: 'رقم اللوحة',     key: 'plate',           width: 16 },
      { header: 'نوع المركبة',    key: 'vehicle_type',    width: 24 },
      { header: 'المشروع',        key: 'project',         width: 14 },
      { header: 'الورشة',         key: 'workshop',        width: 28 },
      { header: 'الحالة',         key: 'status',          width: 26 },
      { header: 'تاريخ الدخول',   key: 'received_date',   width: 14 },
      { header: 'وقت الدخول',     key: 'received_time',   width: 12 },
      { header: 'تاريخ الإغلاق',  key: 'completed_date',  width: 14 },
      { header: 'وقت الإغلاق',    key: 'completed_time',  width: 12 },
      { header: 'نوع الإغلاق',    key: 'closure_type',    width: 16 },
      { header: 'عدد الأيام',     key: 'days_count',      width: 12 },
      { header: 'البديلة',        key: 'replacement',     width: 16 },
    ],
    rows,
    'all_cases',
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
