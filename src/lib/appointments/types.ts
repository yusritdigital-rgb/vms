// =====================================================
// Shared types + helpers for the Appointments module.
// Pure — no React / no Supabase so the modal and the list can both
// import freely.
// =====================================================

// ─── Status (new vocabulary) ─────────────────────────────────────────────
// See migration 009 — the DB CHECK accepts exactly these six values.
//   'scheduled'  بانتظار الموعد   (default when the appointment is created)
//   'checked_in' تم الحضور
//   'no_show'    لم يحضر العميل
//   'cancelled'  تم الإلغاء
//   'inspected'  تمت المعاينة
//   'done'       مكتمل            (legacy — kept for back-compat)
export type AppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'no_show'
  | 'cancelled'
  | 'inspected'
  | 'done'

export const STATUS_LABEL_AR: Record<AppointmentStatus, string> = {
  scheduled:  'بانتظار الموعد',
  checked_in: 'تم الحضور',
  no_show:    'لم يحضر العميل',
  cancelled:  'تم الإلغاء',
  inspected:  'تمت المعاينة',
  done:       'مكتمل',
}

export const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  scheduled:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  checked_in: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  no_show:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled:  'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  inspected:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  done:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

// ─── Appointment type ────────────────────────────────────────────────────
export type AppointmentType = 'maintenance' | 'inspection' | 'delivery' | 'other'

export const TYPE_LABEL_AR: Record<AppointmentType, string> = {
  maintenance: 'صيانة',
  inspection:  'معاينة',
  delivery:    'تسليم',
  other:       'أخرى',
}

export interface Appointment {
  id: string
  appointment_number: string
  customer_name: string
  customer_phone: string | null
  vehicle_id: string | null
  vehicle_plate: string | null
  vehicle_label: string | null
  mileage: number | null
  complaint: string | null
  notes: string | null
  scheduled_date: string    // YYYY-MM-DD
  scheduled_time: string    // HH:MM  (or HH:MM:SS from DB — we normalise)
  status: AppointmentStatus
  appointment_type: AppointmentType | null
  attendance_marked_at: string | null
  created_at: string
  last_updated_at: string
}

// ─── Date helpers (pure; all comparisons done at day-granularity) ───

/** Local-timezone YYYY-MM-DD for a given Date. */
export function toYMD(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Start-of-day in the local timezone. */
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate()
}

export function isPast(d: Date, ref = new Date()): boolean {
  return startOfDay(d).getTime() < startOfDay(ref).getTime()
}

/** Arabic weekday names (Sunday=0 → "الأحد"). */
export const AR_WEEKDAYS_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
export const AR_WEEKDAYS_LONG  = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** Arabic month names. */
export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

/**
 * Build a nice Arabic summary line: "الثلاثاء 21 أبريل — 10:00 ص".
 * Pure function, no locale dependencies.
 */
export function formatAppointmentSummaryAr(
  date: Date | null,
  time: string | null
): string {
  if (!date) return ''
  const day   = AR_WEEKDAYS_LONG[date.getDay()]
  const month = AR_MONTHS[date.getMonth()]
  const parts = [`${day} ${date.getDate()} ${month}`]
  if (time) parts.push(formatTimeLabelAr(time))
  return parts.join(' — ')
}

/** "14:30" → "2:30 مساءً" / "08:00" → "8:00 صباحًا". */
export function formatTimeLabelAr(hhmm: string): string {
  const [hRaw = '0', mRaw = '0'] = hhmm.split(':')
  const h24 = parseInt(hRaw, 10) || 0
  const m   = (parseInt(mRaw, 10) || 0).toString().padStart(2, '0')
  const period = h24 < 12 ? 'صباحًا' : 'مساءً'
  const h12 = ((h24 + 11) % 12) + 1
  return `${h12}:${m} ${period}`
}

/** Build the default working-day slot list: "HH:MM" strings. */
export function buildTimeSlots(
  opts: { startHour?: number; endHour?: number; stepMinutes?: number } = {}
): string[] {
  const startHour = opts.startHour ?? 8
  const endHour   = opts.endHour   ?? 18      // exclusive
  const step      = opts.stepMinutes ?? 30
  const out: string[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

/** "HH:MM[:SS]" → "HH:MM". Safe on empty / malformed. */
export function normaliseTime(t: string | null | undefined): string {
  if (!t) return ''
  const parts = String(t).split(':')
  if (parts.length < 2) return ''
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

export function formatAppointmentNumber(year: number, seq: number): string {
  return `APT-${year}-${String(seq).padStart(4, '0')}`
}

/**
 * Build a countdown string from now until the appointment date+time.
 * Returns something like:
 *   - "بعد 2 يوم 3 ساعات"   (future, >= 1 day)
 *   - "بعد 4 ساعات 12 دقيقة" (future, < 1 day)
 *   - "الآن"                 (within 1 minute either way)
 *   - "منذ 35 دقيقة"         (past, same day)
 *   - "قبل 3 أيام"           (past, >= 1 day)
 */
export function formatCountdownAr(
  scheduledDate: string | null | undefined,
  scheduledTime: string | null | undefined,
  now: Date = new Date()
): { label: string; isPastDue: boolean; deltaMs: number } {
  if (!scheduledDate) return { label: '—', isPastDue: false, deltaMs: 0 }
  const t = normaliseTime(scheduledTime) || '00:00'
  const when = new Date(`${scheduledDate}T${t}:00`)
  const delta = when.getTime() - now.getTime()
  const abs = Math.abs(delta)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (abs < minute) return { label: 'الآن', isPastDue: false, deltaMs: delta }

  const days = Math.floor(abs / day)
  const hours = Math.floor((abs % day) / hour)
  const mins = Math.floor((abs % hour) / minute)

  let body: string
  if (days >= 1) {
    body = `${days} يوم${hours ? ` ${hours} ساعة` : ''}`
  } else if (hours >= 1) {
    body = `${hours} ساعة${mins ? ` ${mins} دقيقة` : ''}`
  } else {
    body = `${mins} دقيقة`
  }
  const label = delta >= 0 ? `بعد ${body}` : (days >= 1 ? `قبل ${body}` : `منذ ${body}`)
  return { label, isPastDue: delta < 0, deltaMs: delta }
}
