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
