'use client'

// =====================================================
// useCasesStream — live list of cases for the Cases page.
// -----------------------------------------------------
// Contract:
//   - On mount: fetches ALL cases (open + closed) via a single
//     query. The page slices them into open/closed in a useMemo.
//   - Subscribes to Supabase Realtime on `job_cards`. Every
//     INSERT/UPDATE/DELETE is merged into local state in place
//     — no re-fetch is needed for events originating from any
//     tab / user.
//   - `refresh()` forces a full re-fetch (used after a local
//     mutation as belt-and-suspenders in case Realtime is off).
// =====================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CaseRow } from './types'
import { logPgError } from './queries'

// Primary select — only `job_cards` + the single safe embed to `vehicles`.
// No `job_card_works`, no `job_card_damages`, no `job_card_spare_parts`,
// no `case_updates` join. Any broken optional relation must NOT be able
// to crash the cases list.
const CASE_SELECT = `
  id, job_card_number, type, status, closure_type,
  received_at, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by,
  vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, project_code, brand, model),
  replacement_vehicle:vehicles!job_cards_replacement_vehicle_id_fkey(id, plate_number, project_code, brand, model)
`

// Last-resort select — NO joins at all. If even `vehicle:vehicles(...)`
// fails (e.g. FK missing or schema cache stale), we still want the list
// to render with bare case data.
const CASE_SELECT_BARE = `
  id, job_card_number, type, status, closure_type,
  received_at, completed_at, delivered_at,
  workshop_id, workshop_name, workshop_city,
  vehicle_id, replacement_vehicle_id,
  complaint_description, internal_notes,
  entry_odometer, exit_odometer,
  created_at, last_updated_at, last_updated_by,
  vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, project_code, brand, model),
  replacement_vehicle:vehicles!job_cards_replacement_vehicle_id_fkey(id, plate_number, project_code, brand, model)
`

export interface UseCasesStream {
  cases: CaseRow[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useCasesStream(): UseCasesStream {
  const [cases, setCases]   = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  // Full re-fetch with graceful fallback.
  // Flow:
  //   1. Try the primary select (with vehicle embed).
  //   2. If that errors, log the full PostgREST error AND retry with the
  //      bare select. The page must ALWAYS load, even if the embed breaks.
  //   3. If even the bare select errors, log and set an empty list so the
  //      page shows an empty state instead of hanging on loading=true.
  const refresh = useCallback(async () => {
    const supabase = createClient()

    // 1st attempt — with embed.
    const primary = await supabase
      .from('job_cards')
      .select(CASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (!mountedRef.current) return

    if (!primary.error) {
      setCases((primary.data as unknown as CaseRow[]) ?? [])
      setLoading(false)
      return
    }

    logPgError('[cases error] primary fetch failed — retrying without embed', primary.error, {
      selectClause: CASE_SELECT.replace(/\s+/g, ' ').trim(),
    })
    // Also log raw so the user sees the real object next to the tag.
    // eslint-disable-next-line no-console
    console.log('[cases error]', primary.error)

    // 2nd attempt — bare, no joins.
    const bare = await supabase
      .from('job_cards')
      .select(CASE_SELECT_BARE)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (!mountedRef.current) return

    if (bare.error) {
      logPgError('[cases error] bare fallback fetch also failed', bare.error, {
        selectClause: CASE_SELECT_BARE.replace(/\s+/g, ' ').trim(),
      })
      // eslint-disable-next-line no-console
      console.log('[cases error]', bare.error)
      setCases([])
      setLoading(false)
      return
    }

    // Shape a CaseRow-compatible list with vehicle = null so the UI still
    // renders (CaseCard / ArchiveTable already tolerate null vehicle).
    const rows = ((bare.data as any[]) ?? []).map(r => ({ ...r, vehicle: null }))
    setCases(rows as unknown as CaseRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()

    // Realtime merge — INSERT appends, UPDATE replaces, DELETE removes.
    const supabase = createClient()
    const channel = supabase
      .channel('cases-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_cards' },
        async (payload) => {
          if (!mountedRef.current) return
          // The payload only carries raw column data — it won't include
          // the embedded vehicle join. Re-fetch the single row through
          // the canonical select to keep shape consistent.
          const id = (payload.new as any)?.id ?? (payload.old as any)?.id
          if (!id) return

          if (payload.eventType === 'DELETE') {
            setCases(prev => prev.filter(c => c.id !== id))
            return
          }
          // Same two-step fallback as refresh(), scoped to a single row.
          let row: any = null
          const p1 = await supabase
            .from('job_cards')
            .select(CASE_SELECT)
            .eq('id', id)
            .maybeSingle()
          if (p1.error) {
            logPgError('[cases error] realtime refetch (embed) failed', p1.error, {
              id, eventType: payload.eventType,
            })
            const p2 = await supabase
              .from('job_cards')
              .select(CASE_SELECT_BARE)
              .eq('id', id)
              .maybeSingle()
            if (p2.error) {
              logPgError('[cases error] realtime refetch (bare) also failed', p2.error, {
                id, eventType: payload.eventType,
              })
              return
            }
            row = p2.data ? { ...p2.data, vehicle: null } : null
          } else {
            row = p1.data
          }
          if (!row || !mountedRef.current) return
          setCases(prev => {
            const next = prev.filter(c => c.id !== id)
            next.unshift(row as CaseRow)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { cases, loading, refresh }
}
