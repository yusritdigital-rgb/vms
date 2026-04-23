'use client'

// =====================================================
// useAllVehicles
// -----------------------------------------------------
// Single source of truth for "give me every vehicle in the system"
// across selectors (Cases, Appointments, Invoices, Alternatives, etc).
//
// Why this hook exists:
//   PostgREST applies a default server cap of ~1000 rows on any
//   SELECT without an explicit range. If vehicles has more rows, a
//   plain `.from('vehicles').select('*')` silently drops the rest,
//   so searching for an existing vehicle in a dropdown may fail even
//   though the row is in the database.
//
// This hook paginates internally in 1000-row pages until a short
// page is returned, then exposes the full list with a rich
// `searchText` haystack (Arabic plate, English plate, chassis,
// brand, manufacturer, model, project code).
// =====================================================

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface VehicleLite {
  id: string
  plate_number: string | null
  plate_number_ar: string | null
  chassis_number: string | null
  brand: string | null
  manufacturer: string | null
  model: string | null
  current_odometer: number | null
  project_code: string | null
}

const PAGE_SIZE = 1000

export function buildVehicleSearchText(v: VehicleLite): string {
  return [
    v.plate_number,
    v.plate_number_ar,
    v.chassis_number,
    v.brand,
    v.manufacturer,
    v.model,
    v.project_code,
  ]
    .filter(Boolean)
    .join(' ')
}

export function formatVehicleLabel(v: VehicleLite): string {
  // Prefer English plate; fall back to Arabic plate; else chassis.
  return (v.plate_number || v.plate_number_ar || v.chassis_number || '—') as string
}

export function formatVehicleSublabel(v: VehicleLite): string {
  const mk = v.brand || v.manufacturer || ''
  const parts = [mk, v.model].filter(Boolean).join(' ').trim()
  return parts || (v.chassis_number ?? '')
}

export function useAllVehicles(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true
  const [vehicles, setVehicles] = useState<VehicleLite[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const all: VehicleLite[] = []
    let from = 0
    // Safety stop at 50 pages (50k vehicles) to avoid runaway loops.
    for (let page = 0; page < 50; page++) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate_number, plate_number_ar, chassis_number, brand, manufacturer, model, current_odometer, project_code')
        .order('plate_number', { ascending: true, nullsFirst: false })
        .range(from, to)
      if (error) {
        setError(error.message)
        break
      }
      const chunk = (data as VehicleLite[]) ?? []
      all.push(...chunk)
      if (chunk.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    setVehicles(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
  }, [enabled, load])

  return { vehicles, loading, error, reload: load }
}
