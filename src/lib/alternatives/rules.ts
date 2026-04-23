// =====================================================
// Alternatives (البدائل) — RV project vehicles
// -----------------------------------------------------
// "Alternatives" in the new VMS is the replacement-vehicle pool sourced
// from the `project_code` field on the `vehicles` table. A vehicle is
// treated as an Alternative when its `project_code` starts with "RV"
// (case-insensitive, ignoring surrounding whitespace). This covers the
// common variations found in CSV imports: "RV", "RV-2024", "rv_jeddah",
// " RV ", etc.
//
// This helper is intentionally pure so both the Alternatives page and
// the Create Case replacement-vehicle selector can import it freely.
// =====================================================

export function isRvProjectCode(code: string | null | undefined): boolean {
  if (!code) return false
  return /^rv/i.test(String(code).trim())
}

/** Filter a list of vehicles to only those in the RV Alternatives pool. */
export function filterRvVehicles<T extends { project_code?: string | null }>(
  list: T[]
): T[] {
  return list.filter(v => isRvProjectCode(v.project_code ?? null))
}
