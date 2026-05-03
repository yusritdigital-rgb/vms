// =====================================================
// Shared types + helpers for the Misuse module.
// Kept separate from UI so the PDF generator and the pages
// can both import without pulling React.
// =====================================================

export const DEFAULT_VAT_PERCENTAGE = 15

export interface MisuseLaborItem {
  id?: string
  row_number: number
  description: string
  cost: number
}

export interface MisuseSparePartItem {
  id?: string
  row_number: number
  part_name: string
  quantity: number
  unit_price: number
  /** Derived — kept on client for convenience; DB regenerates. */
  line_total?: number
}

export interface MisuseRegistration {
  id: string
  registration_number: string
  registration_date: string          // YYYY-MM-DD

  project_name: string | null
  vehicle_id: string | null
  vehicle_type: string | null
  plate_number: string | null

  notes: string | null

  subtotal: number
  discount_percentage: number
  discount_amount: number
  vat_percentage: number
  vat_amount: number
  total: number

  payment_status: 'pending' | 'paid' | 'rejected' | null
  payment_notes: string | null

  created_by: string | null
  created_at: string
  last_updated_by: string | null
  last_updated_at: string
}

export interface MisuseRegistrationWithItems extends MisuseRegistration {
  labor_items: MisuseLaborItem[]
  spare_part_items: MisuseSparePartItem[]
}

// ─── Pure helpers (no React / no Supabase) ─────────────

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function laborTotal(items: Pick<MisuseLaborItem, 'cost'>[]): number {
  return round2(items.reduce((acc, it) => acc + (Number(it.cost) || 0), 0))
}

export function partsTotal(
  items: Pick<MisuseSparePartItem, 'quantity' | 'unit_price'>[]
): number {
  return round2(
    items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  )
}

/**
 * Compute the full totals stack:
 *   subtotal         = laborTotal + partsTotal
 *   discount_amount  = subtotal * discountPct / 100
 *   vat_amount       = (subtotal - discount_amount) * vatPct / 100
 *   total            = (subtotal - discount_amount) + vat_amount
 */
export function computeMisuseTotals(
  labor: Pick<MisuseLaborItem, 'cost'>[],
  parts: Pick<MisuseSparePartItem, 'quantity' | 'unit_price'>[],
  discountPercentage: number,
  vatPercentage: number
): {
  labor_total: number
  parts_total: number
  subtotal: number
  discount_amount: number
  vat_amount: number
  total: number
} {
  const labor_total = laborTotal(labor)
  const parts_total = partsTotal(parts)
  const subtotal = round2(labor_total + parts_total)
  const discount_amount = round2(subtotal * ((Number(discountPercentage) || 0) / 100))
  const taxable = round2(subtotal - discount_amount)
  const vat_amount = round2(taxable * ((Number(vatPercentage) || 0) / 100))
  const total = round2(taxable + vat_amount)
  return { labor_total, parts_total, subtotal, discount_amount, vat_amount, total }
}

/** Build a human-friendly misuse registration number: MU-YYYY-NNNN. */
export function formatMisuseNumber(year: number, seq: number): string {
  return `MU-${year}-${String(seq).padStart(4, '0')}`
}

export function formatCurrency(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
