// =====================================================
// Shared types + constants for the Invoices module.
// Kept separate from UI so the PDF generator and the pages
// can both import without pulling React.
// =====================================================

export const INTERNAL_WORKSHOP_AR = 'ورشة الأوائل'
export const INTERNAL_WORKSHOP_EN = 'Al-Awael Workshop'
export const DEFAULT_VAT_PERCENTAGE = 15

export type InvoiceStatus = 'draft' | 'issued' | 'cancelled'

/** Repair categories shown in the form's "نوع الإصلاح" dropdown. */
export const REPAIR_TYPES = [
  'حادث',
  'ميكانيكا',
  'هيكل',
  'دهان',
  'تشخيص',
  'أخرى',
] as const
export type RepairType = typeof REPAIR_TYPES[number]

export type InvoiceItemType = 'spare_part' | 'labor' | 'inspection' | 'other'

export const ITEM_TYPE_LABEL_AR: Record<InvoiceItemType, string> = {
  spare_part: 'قطعة غيار',
  labor:      'أجرة عمل',
  inspection: 'فحص وتشخيص',
  other:      'أخرى',
}

export const STATUS_LABEL_AR: Record<InvoiceStatus, string> = {
  draft:     'مسودة',
  issued:    'مصدرة',
  cancelled: 'ملغاة',
}

export const STATUS_BADGE_CLASS: Record<InvoiceStatus, string> = {
  draft:
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  issued:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export interface InvoiceItem {
  id?: string
  row_number: number
  item_type: InvoiceItemType
  description: string
  quantity: number
  unit_price: number
  /** Derived — kept on client for convenience; DB regenerates. */
  line_total?: number
}

export interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string            // YYYY-MM-DD
  status: InvoiceStatus
  repair_type: string | null
  workshop_name: string
  maintenance_manager: string | null
  technician: string | null
  work_hours: number | null
  beneficiary_company: string | null
  notes: string | null

  vehicle_id: string | null
  vehicle_plate: string | null
  vehicle_label: string | null
  project: string | null

  subtotal: number
  vat_percentage: number
  vat_amount: number
  total: number

  created_by: string | null
  created_at: string
  last_updated_by: string | null
  last_updated_at: string
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}

// ─── Pure helpers (no React / no Supabase) ────────────────

/** Round to 2 decimals, handling JS float noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function computeTotals(
  items: Pick<InvoiceItem, 'quantity' | 'unit_price'>[],
  vatPercentage: number
): { subtotal: number; vat_amount: number; total: number } {
  const subtotal = round2(
    items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  )
  const vat_amount = round2(subtotal * (vatPercentage / 100))
  const total = round2(subtotal + vat_amount)
  return { subtotal, vat_amount, total }
}

/**
 * Build a human-friendly invoice number: INV-YYYY-NNNN.
 * The caller is expected to pass the next sequence number (usually
 * `(max existing for year) + 1`). The UNIQUE constraint on
 * `invoices.invoice_number` plus a small retry loop in the insert
 * code is what actually guarantees uniqueness under races.
 */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(4, '0')}`
}

/** Format an amount for display, e.g. 1234.5 → "1,234.50". */
export function formatCurrency(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
