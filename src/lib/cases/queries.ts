// =====================================================
// Cases module — ALL DB access goes through here.
// -----------------------------------------------------
// Components never import supabase directly for cases data.
// This module owns the exact column sets, join shapes,
// and invariants (e.g. "closing a case releases the
// alternative and stamps completed_at").
// =====================================================

import { createClient } from '@/lib/supabase/client'
import { CLOSED_STATUSES } from './statuses'
import type { CaseRow, CaseUpdateRow } from './types'
import { isClosedStatus } from './types'

// ─────────────────────────────────────────────────────
// Error logging helper
// -----------------------------------------------------
// Supabase/PostgREST errors are plain objects that stringify to "[object
// Object]" in the default console formatter. This helper dumps every
// field we actually care about (code/message/details/hint) so bugs are
// diagnosable from the browser console without guessing.
// ─────────────────────────────────────────────────────
export function logPgError(tag: string, error: unknown, extra?: Record<string, unknown>) {
  const e = error as any
  // eslint-disable-next-line no-console
  console.error(tag, {
    code:    e?.code,
    message: e?.message,
    details: e?.details,
    hint:    e?.hint,
    status:  e?.status,
    ...(extra ?? {}),
    raw:     error,
  })
}

// Primary select — only `job_cards` + safe vehicles embed. No joins to
// job_card_works / job_card_damages / job_card_spare_parts / case_updates.
const CASE_SELECT = `
  id, job_card_number, type, status, closure_type,
  received_at, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by,
  vehicle:vehicles(plate_number, project_code, brand, model, chassis_number)
`

// Bare fallback — zero joins. Used when the embed above errors, so a
// broken relation (missing FK, stale schema cache, RLS on vehicles)
// can never take the whole cases module down.
const CASE_SELECT_BARE = `
  id, job_card_number, type, status, closure_type,
  received_at, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by
`

// ─────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────

/** All non-closed cases, newest first. Used by Daily Update. */
export async function listOpenCases(): Promise<CaseRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_cards')
    .select(CASE_SELECT)
    .not('status', 'in', `(${CLOSED_STATUSES.map(s => `"${s}"`).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) { logPgError('[cases/queries] listOpenCases failed', error); return [] }
  return (data as unknown as CaseRow[]) ?? []
}

/** Paginated full list — used by the archive. */
export async function listAllCases(args: {
  page: number
  pageSize: number   // 0 = no limit
  status: 'all' | 'closed' | string
  search: string
}): Promise<{ rows: CaseRow[]; count: number }> {
  const supabase = createClient()
  let query = supabase
    .from('job_cards')
    .select(CASE_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (args.status === 'closed') {
    query = query.in('status', CLOSED_STATUSES as unknown as string[])
  } else if (args.status !== 'all') {
    query = query.eq('status', args.status)
  }
  if (args.search.trim()) {
    query = query.ilike('job_card_number', `%${args.search.trim()}%`)
  }
  if (args.pageSize > 0) {
    const from = (args.page - 1) * args.pageSize
    query = query.range(from, from + args.pageSize - 1)
  }

  const { data, count, error } = await query
  if (error) { logPgError('[cases/queries] listAllCases failed', error, { args }); return { rows: [], count: 0 } }
  return { rows: (data as unknown as CaseRow[]) ?? [], count: count ?? 0 }
}

/** A single case by id. Falls back to a bare select if the embed errors. */
export async function getCase(id: string): Promise<CaseRow | null> {
  const supabase = createClient()
  const p1 = await supabase
    .from('job_cards')
    .select(CASE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (!p1.error) return (p1.data as unknown as CaseRow) ?? null

  logPgError('[cases error] getCase (embed) failed — retrying bare', p1.error, { id })
  // eslint-disable-next-line no-console
  console.log('[cases error]', p1.error)

  const p2 = await supabase
    .from('job_cards')
    .select(CASE_SELECT_BARE)
    .eq('id', id)
    .maybeSingle()
  if (p2.error) {
    logPgError('[cases error] getCase (bare) also failed', p2.error, { id })
    // eslint-disable-next-line no-console
    console.log('[cases error]', p2.error)
    return null
  }
  return p2.data ? ({ ...p2.data, vehicle: null } as unknown as CaseRow) : null
}

/** Every update for a case, oldest → newest (top-down timeline). */
export async function listCaseUpdates(caseId: string): Promise<CaseUpdateRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('case_updates')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  if (error) { logPgError('[cases/queries] listCaseUpdates failed', error, { caseId }); return [] }
  return (data as unknown as CaseUpdateRow[]) ?? []
}

/** Closed-only list for the History page. */
export async function listClosedCases(): Promise<CaseRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_cards')
    .select(CASE_SELECT)
    .in('status', CLOSED_STATUSES as unknown as string[])
    .order('completed_at', { ascending: false })
    .limit(1000)
  if (error) { logPgError('[cases/queries] listClosedCases failed', error); return [] }
  return (data as unknown as CaseRow[]) ?? []
}

// ─────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────

export interface CreateCaseInput {
  vehicle_id: string
  type: 'accident' | 'mechanical'
  workshop_id: string | null
  workshop_name: string | null
  workshop_city: string | null
  entry_odometer: number
  received_at: string   // ISO
  complaint_description: string | null
  internal_notes: string | null
  has_replacement_vehicle: boolean
  replacement_vehicle_id: string | null
  no_replacement_reason: string | null
  no_replacement_reason_custom: string | null
}

/** Create a case. Returns the full new row. */
export async function createCase(input: CreateCaseInput): Promise<CaseRow> {
  const supabase = createClient()

  const payload: Record<string, any> = {
    vehicle_id:              input.vehicle_id,
    type:                    input.type,
    status:                  'بانتظار تقدير',
    workshop_id:             input.workshop_id,
    workshop_name:           input.workshop_name,
    workshop_city:           input.workshop_city,
    entry_odometer:          input.entry_odometer,
    received_at:             input.received_at,
    complaint_description:   input.complaint_description,
    internal_notes:          input.internal_notes,
    has_replacement_vehicle: input.has_replacement_vehicle,
    replacement_vehicle_id:  input.replacement_vehicle_id,
    no_replacement_reason:   input.no_replacement_reason,
    no_replacement_reason_custom: input.no_replacement_reason_custom,
  }

  const { data, error } = await supabase
    .from('job_cards')
    .insert(payload)
    .select(CASE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as CaseRow
}

/**
 * Apply a case update (daily update flow).
 *
 * Order:
 *   1. INSERT into case_updates (source='manual') with denormalised user name.
 *   2. If the status actually changed, UPDATE job_cards.status (the stamp
 *      trigger handles last_updated_by/at). When the new status is closed,
 *      also clear replacement_vehicle_id and stamp completed_at in the same
 *      UPDATE so the alternative returns to the pool atomically.
 */
export async function applyCaseUpdate(args: {
  caseId: string
  newStatus: string
  currentStatus: string
  note: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let fullName: string | null = null
  if (user?.id) {
    const { data: pref } = await supabase
      .from('user_preferences')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
    fullName = (pref as any)?.full_name ?? user.email ?? null
  }

  const { error: insErr } = await supabase.from('case_updates').insert({
    case_id:         args.caseId,
    status:          args.newStatus,
    note:            args.note && args.note.trim() ? args.note.trim() : null,
    updated_by:      user?.id ?? null,
    updated_by_name: fullName,
    source:          'manual',
  })
  if (insErr) return { ok: false, error: insErr.message }

  if (args.newStatus !== args.currentStatus) {
    const patch: Record<string, any> = { status: args.newStatus }
    if (isClosedStatus(args.newStatus)) {
      patch.completed_at = new Date().toISOString()
      patch.replacement_vehicle_id = null
    }
    const { error: upErr } = await supabase
      .from('job_cards')
      .update(patch)
      .eq('id', args.caseId)
    if (upErr) return { ok: false, error: upErr.message }
  }
  return { ok: true }
}
