// =====================================================
// Cases module — shared types
// -----------------------------------------------------
// Keep these small and close to the DB. The UI layer
// owns its own view-models on top of these.
// =====================================================

import { CLOSED_STATUSES } from './statuses'

/** A job_cards row as used by the Cases module. */
export interface CaseRow {
  id: string
  job_card_number: string
  type: 'accident' | 'mechanical' | string
  status: string
  closure_type: string | null
  received_at: string
  expected_completion_date: string | null  // YYYY-MM-DD (DATE column)
  completed_at: string | null
  delivered_at: string | null
  workshop_id: string | null
  workshop_name: string | null
  workshop_city: string | null
  vehicle_id: string | null
  replacement_vehicle_id: string | null
  replacement_vehicle?: {
    id: string
    plate_number: string | null
    project_code: string | null
    brand: string | null
    model: string | null
  } | null
  replacement_return_odometer: number | null
  replacement_return_date: string | null
  replacement_return_notes: string | null
  complaint_description: string | null
  internal_notes: string | null
  customer_phone: string | null
  entry_odometer: number
  exit_odometer: number | null
  created_at: string
  last_updated_at: string | null
  last_updated_by: string | null
  // Embedded vehicle snapshot (nullable — vehicle may have been removed)
  vehicle: {
    plate_number: string | null
    project_code: string | null
    brand: string | null
    model: string | null
    chassis_number: string | null
  } | null
}

/** A case_updates row as rendered by the timeline. */
export interface CaseUpdateRow {
  id: string
  case_id: string
  status: string
  note: string | null
  updated_by: string | null
  updated_by_name: string | null
  source: 'manual' | 'trigger'
  created_at: string
}

/** Canonical open/closed split — the ONLY place this logic lives. */
export function isClosedStatus(status: string | null | undefined): boolean {
  return !!status && (CLOSED_STATUSES as readonly string[]).includes(status)
}
