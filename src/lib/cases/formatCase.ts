// =====================================================
// Cases module — tiny formatters
// -----------------------------------------------------
// Presentation-only helpers. No DB, no state.
// =====================================================

import { format } from 'date-fns'

const MS_DAY = 24 * 60 * 60 * 1000

/** Whole days between `iso` and now (floored, min 0). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / MS_DAY))
}

/** Short relative-time ("2h ago" / "قبل 2س"). */
export function relativeTime(iso: string | null | undefined, isAr: boolean): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const diff = Date.now() - t
  if (diff < 0) return null
  const min = Math.floor(diff / 60000)
  if (min < 1)   return isAr ? 'الآن'          : 'just now'
  if (min < 60)  return isAr ? `قبل ${min} د`  : `${min}m ago`
  const hr  = Math.floor(min / 60)
  if (hr  < 24) return isAr ? `قبل ${hr} س`   : `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return isAr ? `قبل ${day} يوم` : `${day}d ago`
  const mo  = Math.floor(day / 30)
  return isAr ? `قبل ${mo} شهر` : `${mo}mo ago`
}

/** Absolute date (yyyy-MM-dd), safe on nulls / invalid. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'yyyy-MM-dd') } catch { return '—' }
}

/** Absolute date+time (yyyy-MM-dd HH:mm), safe on nulls / invalid. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'yyyy-MM-dd HH:mm') } catch { return '—' }
}

/**
 * True iff `expected` (YYYY-MM-DD or any parseable date) is strictly before
 * today (local). Used to flag open cases that have passed their planned
 * completion date as "متأخرة".
 */
export function isOverdue(expected: string | null | undefined): boolean {
  const d = daysUntil(expected)
  return d !== null && d < 0
}

/**
 * Calendar-day delta between today and `expected` (positive = days remaining,
 * 0 = due today, negative = overdue). Returns null if the input is missing
 * or unparseable. Day boundary is local midnight, so a case with expected
 * date == today shows "باقي: 0 أيام" (still on time) until tomorrow.
 */
export function daysUntil(expected: string | null | undefined): number | null {
  if (!expected) return null
  const t = new Date(expected).getTime()
  if (!Number.isFinite(t)) return null
  const exp = new Date(t); exp.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - today.getTime()) / MS_DAY)
}

/**
 * Compact label for an expected-completion date, designed to be appended
 * inline (after a `|` separator) next to an existing received-date in
 * the open-cases list. Returns one of:
 *
 *   • `متوقع: بعد N أيام`     (when remain > 1)
 *   • `قرب انتهاء`            (when 0 ≤ remain ≤ 1)
 *   • `متأخرة: N يوم`         (when remain < 0)
 *
 * The `tone` field tells the caller which subtle colour to use; no badges,
 * borders, icons, or layout chrome are emitted. Returns null if the date
 * is missing.
 */
export type ExpectedDueTone = 'normal' | 'near' | 'overdue'
export interface ExpectedDueLabel {
  text: string
  tone: ExpectedDueTone
}
export function expectedDueLabel(
  expected: string | null | undefined,
  isAr: boolean,
): ExpectedDueLabel | null {
  const remain = daysUntil(expected)
  if (remain === null) return null
  if (remain < 0) {
    const n = Math.abs(remain)
    return {
      tone: 'overdue',
      text: isAr ? `متأخرة: ${n} يوم` : `Overdue: ${n}d`,
    }
  }
  if (remain <= 1) {
    return {
      tone: 'near',
      text: isAr ? 'قرب انتهاء' : 'Near due',
    }
  }
  return {
    tone: 'normal',
    text: isAr ? `متوقع: بعد ${remain} أيام` : `Expected: in ${remain}d`,
  }
}
