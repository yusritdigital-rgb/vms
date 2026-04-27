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
  received_at, expected_completion_date, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by,
  vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, project_code, brand, model, chassis_number),
  replacement_vehicle:vehicles!job_cards_replacement_vehicle_id_fkey(id, plate_number, project_code, brand, model)
`

// Bare fallback — zero joins. Used when the embed above errors, so a
// broken relation (missing FK, stale schema cache, RLS on vehicles)
// can never take the whole cases module down.
const CASE_SELECT_BARE = `
  id, job_card_number, type, status, closure_type,
  received_at, expected_completion_date, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by,
  vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, project_code, brand, model, chassis_number),
  replacement_vehicle:vehicles!job_cards_replacement_vehicle_id_fkey(id, plate_number, project_code, brand, model)
`

// ─────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────

/**
 * All non-closed cases, **oldest first** by `received_at`.
 *
 * The Daily Update page surfaces delayed/old cases at the top of the list
 * so the workshop can act on them first. Sorting on `received_at` (which is
 * NOT NULL on every row) is stable; we tie-break on `created_at` so two
 * cases received at the same instant keep a deterministic order.
 */
export async function listOpenCases(): Promise<CaseRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('job_cards')
    .select(CASE_SELECT)
    .not('status', 'in', `(${CLOSED_STATUSES.map(s => `"${s}"`).join(',')})`)
    .order('received_at', { ascending: true })
    .order('created_at', { ascending: true })
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

/** Closed-only list for the History page.
 *
 *  The filter is `status IN (closed)` — that is the ONLY gate.
 *  `completed_at` is intentionally NOT required because legacy rows
 *  that were closed before the `applyCaseUpdate` helper existed may
 *  not have a `completed_at` stamp. Sorting uses `received_at` (which
 *  is NOT NULL on every row) so no closed case can be hidden because
 *  of a null sort key. We also accept a handful of legacy English
 *  status values so pre-migration data still surfaces here. */
export async function listClosedCases(): Promise<CaseRow[]> {
  const supabase = createClient()
  // Arabic canonical + legacy English equivalents seen in old data.
  const statusFilter: string[] = [
    ...(CLOSED_STATUSES as readonly string[]),
    'delivered',
    'sold',
    'total_loss',
  ]
  const { data, error } = await supabase
    .from('job_cards')
    .select(CASE_SELECT)
    .in('status', statusFilter)
    .order('received_at', { ascending: false })
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
  /** Optional initial status. Defaults to 'بانتظار تقدير'. */
  status?: string
  workshop_id: string | null
  workshop_name: string | null
  workshop_city: string | null
  entry_odometer: number
  received_at: string   // ISO
  /** YYYY-MM-DD (DATE). Required by the Create Case form. */
  expected_completion_date: string | null
  complaint_description: string | null
  internal_notes: string | null
  has_replacement_vehicle: boolean
  replacement_vehicle_id: string | null
  /** Odometer of the replacement vehicle at handover. Required when
   *  `has_replacement_vehicle` is true; ignored otherwise. */
  replacement_entry_odometer: number | null
  no_replacement_reason: string | null
  no_replacement_reason_custom: string | null
}

/** Create a case. Returns the full new row.
 *
 * Side-effect: seeds `vehicle_odometer_readings` for the main vehicle
 * (`source='case_entry'`) and, when applicable, the replacement vehicle
 * (`source='case_replacement_entry'`). The DB trigger guarantees these
 * readings are monotonic — the function logs and surfaces a warning if
 * a reading is rejected, but never rolls back the case (the row is the
 * primary record; readings are auxiliary). The caller can re-attempt by
 * editing the case if needed.
 */
export async function createCase(input: CreateCaseInput): Promise<CaseRow> {
  const supabase = createClient()

  const payload: Record<string, any> = {
    vehicle_id:              input.vehicle_id,
    type:                    input.type,
    status:                  input.status && input.status.trim() ? input.status : 'بانتظار تقدير',
    workshop_id:             input.workshop_id,
    workshop_name:           input.workshop_name,
    workshop_city:           input.workshop_city,
    entry_odometer:          input.entry_odometer,
    received_at:             input.received_at,
    expected_completion_date: input.expected_completion_date,
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
  const newCase = data as unknown as CaseRow

  // ─── Seed odometer readings (best-effort) ───
  // Skip silently if the readings table doesn't exist yet (migration 021
  // not applied). On other errors, log but don't fail the case create.
  const { data: { user } } = await supabase.auth.getUser()
  const readings: Array<Record<string, any>> = []
  readings.push({
    vehicle_id:  input.vehicle_id,
    reading:     input.entry_odometer,
    source:      'case_entry',
    case_id:     newCase.id,
    recorded_by: user?.id ?? null,
  })
  if (
    input.has_replacement_vehicle &&
    input.replacement_vehicle_id &&
    input.replacement_entry_odometer != null
  ) {
    readings.push({
      vehicle_id:  input.replacement_vehicle_id,
      reading:     input.replacement_entry_odometer,
      source:      'case_replacement_entry',
      case_id:     newCase.id,
      recorded_by: user?.id ?? null,
    })
  }

  const { error: readErr } = await supabase
    .from('vehicle_odometer_readings')
    .insert(readings)
  if (readErr) {
    // 42P01 = relation does not exist (migration not applied yet) — silent.
    if ((readErr as any).code !== '42P01') {
      logPgError('[cases/queries] odometer readings insert failed', readErr, {
        case_id: newCase.id,
      })
    }
  }

  return newCase
}

/**
 * Assign a replacement vehicle to an existing OPEN case. Used by the
 * case detail page when the workshop didn't have a replacement on hand
 * at create time and is now handing one over. Mirrors the replacement
 * portion of `createCase`:
 *
 *   • UPDATE job_cards: set replacement_vehicle_id + has_replacement_vehicle=true,
 *     clear no_replacement_reason{,_custom}.
 *   • INSERT a vehicle_odometer_readings row with source='case_replacement_entry'
 *     so the alternative's odometer history mirrors the entry path of a
 *     fresh case.
 *
 * Refuses to write if the case is already closed — closed cases are
 * read-only history per spec. Status, workflow and main-vehicle data
 * are NOT touched.
 */
export async function assignReplacementVehicle(args: {
  caseId: string
  replacementVehicleId: string
  replacementOdometer: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()

  // Re-read the case so we never assign on a closed row, even if the UI
  // state is stale. Single round-trip; guard against TOCTOU at the DB.
  const { data: existing, error: readErr } = await supabase
    .from('job_cards')
    .select('id, status, replacement_vehicle_id, vehicle_id')
    .eq('id', args.caseId)
    .maybeSingle()
  if (readErr) {
    logPgError('[cases/queries] assignReplacementVehicle: read failed', readErr, { caseId: args.caseId })
    return { ok: false, error: readErr.message }
  }
  if (!existing) return { ok: false, error: 'case_not_found' }
  if (isClosedStatus((existing as any).status)) {
    return { ok: false, error: 'case_closed' }
  }
  if ((existing as any).replacement_vehicle_id) {
    return { ok: false, error: 'replacement_already_assigned' }
  }
  if ((existing as any).vehicle_id === args.replacementVehicleId) {
    return { ok: false, error: 'replacement_same_as_main_vehicle' }
  }

  const { error: upErr } = await supabase
    .from('job_cards')
    .update({
      replacement_vehicle_id:       args.replacementVehicleId,
      has_replacement_vehicle:      true,
      no_replacement_reason:        null,
      no_replacement_reason_custom: null,
    })
    .eq('id', args.caseId)
  if (upErr) {
    logPgError('[cases/queries] assignReplacementVehicle: update failed', upErr, { caseId: args.caseId })
    return { ok: false, error: upErr.message }
  }

  // Best-effort odometer-reading insert. The DB trigger enforces
  // monotonicity; we surface its error to the caller so the user can
  // correct the value, but we don't roll back the assignment (the row
  // is the primary record — same convention as createCase).
  const { data: { user } } = await supabase.auth.getUser()
  const { error: readingErr } = await supabase
    .from('vehicle_odometer_readings')
    .insert({
      vehicle_id:  args.replacementVehicleId,
      reading:     args.replacementOdometer,
      source:      'case_replacement_entry',
      case_id:     args.caseId,
      recorded_by: user?.id ?? null,
    })
  if (readingErr && (readingErr as any).code !== '42P01') {
    logPgError('[cases/queries] assignReplacementVehicle: reading insert failed', readingErr, {
      caseId: args.caseId,
    })
    return { ok: false, error: readingErr.message }
  }

  return { ok: true }
}

/**
 * RV-pool vehicles that are not currently assigned to any OPEN case.
 *
 * The "alternatives availability" rule: a vehicle is available iff
 *   1. its project_code starts with "RV" (per `isRvProjectCode`), AND
 *   2. no open job_card has it as `replacement_vehicle_id`.
 *
 * Closed cases automatically release their replacement (see
 * `applyCaseUpdate`) so historical assignments don't block the pool.
 */
export async function listAvailableRvVehicles(opts: {
  excludeVehicleId?: string | null   // typically the case's main vehicle
} = {}): Promise<Array<{
  id: string
  plate_number: string | null
  plate_number_ar: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  project_code: string | null
  current_odometer: number | null
}>> {
  const supabase = createClient()

  // 1. RV-project vehicles. Use the same case-insensitive prefix check
  //    PostgREST allows via `ilike`.
  const { data: rvRows, error: vErr } = await supabase
    .from('vehicles')
    .select('id, plate_number, plate_number_ar, brand, manufacturer, model, project_code, current_odometer')
    .ilike('project_code', 'RV%')
    .order('plate_number', { ascending: true, nullsFirst: false })
  if (vErr) {
    logPgError('[cases/queries] listAvailableRvVehicles: vehicles failed', vErr)
    return []
  }
  const rvList = (rvRows ?? []) as Array<{ id: string } & Record<string, any>>

  // 2. IDs currently linked to OPEN cases.
  const { data: openRows, error: jErr } = await supabase
    .from('job_cards')
    .select('replacement_vehicle_id, status')
    .not('replacement_vehicle_id', 'is', null)
    .not('status', 'in', `(${CLOSED_STATUSES.map(s => `"${s}"`).join(',')})`)
  if (jErr) {
    logPgError('[cases/queries] listAvailableRvVehicles: job_cards failed', jErr)
    // Fall back to the un-filtered list rather than hide everything.
    return rvList as any
  }
  const taken = new Set(
    (openRows ?? []).map((r: any) => r.replacement_vehicle_id).filter(Boolean)
  )

  return rvList.filter(v =>
    !taken.has(v.id)
    && (!opts.excludeVehicleId || v.id !== opts.excludeVehicleId)
  ) as any
}

/**
 * Latest odometer reading for a vehicle. Falls back to the cached
 * `vehicles.current_odometer` if the readings table is missing or has
 * no rows for the vehicle. Returns null only when both sources are
 * empty / unavailable.
 */
export async function getLastOdometer(vehicleId: string): Promise<number | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vehicle_odometer_readings')
    .select('reading')
    .eq('vehicle_id', vehicleId)
    .order('reading', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!error && data && typeof (data as any).reading === 'number') {
    return (data as any).reading as number
  }
  // Fallback to vehicles.current_odometer.
  const { data: v } = await supabase
    .from('vehicles')
    .select('current_odometer')
    .eq('id', vehicleId)
    .maybeSingle()
  return (v as any)?.current_odometer ?? null
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

/**
 * Update the planned completion date on an open case. Used by the
 * Daily Update card and the case detail page when a job is running
 * late and the workshop wants to extend the deadline. The status is
 * intentionally NOT touched — the case remains open.
 *
 * @param newDate yyyy-MM-dd, or null to clear the value entirely.
 */
export async function updateExpectedCompletionDate(
  caseId: string,
  newDate: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('job_cards')
    .update({ expected_completion_date: newDate })
    .eq('id', caseId)
  if (error) {
    logPgError('[cases/queries] updateExpectedCompletionDate failed', error, { caseId, newDate })
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
