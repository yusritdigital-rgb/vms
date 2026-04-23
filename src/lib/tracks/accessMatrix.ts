// =====================================================
// VMS - Track-based access matrix (SINGLE SOURCE OF TRUTH)
// =====================================================
// Replaces the old company-based permissions model.
// A user is assigned one of:
//   - 'maintenance'  (صيانة)
//   - 'operations'   (تشغيل)
//   - null           => treated as having BOTH tracks (see everything)
//
// Every section in the app maps to a single access level per track:
//   'full' = view + create + edit + delete
//   'view' = read-only (hide create/edit/delete actions)
//   'none' = hidden entirely (not shown in sidebar, route blocked)
// =====================================================

export type Track = 'maintenance' | 'operations' | null

export type Access = 'none' | 'view' | 'full'

/**
 * Internal app sections. These are LOGICAL names — they do not change
 * even though UI labels were renamed (cases, alternatives, invoices,
 * appointments, etc.). URL paths remain the original ones for stability.
 */
export type Section =
  | 'dashboard'
  | 'vehicles'      // was "fleet"            → "Vehicle List"
  | 'history'       // Vehicle History
  | 'cases'         // was "jobCards"         → "Cases / الحالات"
  | 'alternatives'  // was "spareParts"       → "Alternatives / البدائل (RV)"
  | 'invoices'      // was "forms"            → "Invoices / الفواتير"
  | 'appointments'  // was "reserves"         → "Appointments / المواعيد"
  | 'settings'
  | 'notifications'

const MAINTENANCE_ACCESS: Record<Section, Access> = {
  dashboard:     'full',
  vehicles:      'full',
  history:       'full',
  cases:         'full',
  alternatives:  'view',   // RV: view only
  invoices:      'full',
  appointments:  'full',
  settings:      'full',
  notifications: 'full',
}

const OPERATIONS_ACCESS: Record<Section, Access> = {
  dashboard:     'full',
  vehicles:      'full',
  history:       'view',   // read-only for operations
  cases:         'full',
  alternatives:  'full',   // RV: operations own it
  invoices:      'none',   // invoices hidden from operations
  appointments:  'view',   // read-only for operations
  settings:      'full',
  notifications: 'full',
}

/**
 * Returns the effective access level for a given section, given the user's track.
 * A null track (= no track assigned) grants full access to all sections.
 */
export function getAccess(track: Track, section: Section): Access {
  if (track === null || track === undefined) return 'full'
  if (track === 'maintenance') return MAINTENANCE_ACCESS[section]
  if (track === 'operations') return OPERATIONS_ACCESS[section]
  return 'none'
}

export function canView(track: Track, section: Section): boolean {
  const a = getAccess(track, section)
  return a === 'view' || a === 'full'
}

export function canEdit(track: Track, section: Section): boolean {
  return getAccess(track, section) === 'full'
}

/** Map a sidebar/route URL path → Section (for middleware / layout guards). */
export function pathToSection(pathname: string): Section | null {
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/fleet')) return 'vehicles'
  if (pathname.startsWith('/history')) return 'history'
  if (pathname.startsWith('/job-cards')) return 'cases'
  if (pathname.startsWith('/spare-parts')) return 'alternatives'
  if (pathname.startsWith('/forms')) return 'invoices'
  if (pathname.startsWith('/reserves')) return 'appointments'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/notifications')) return 'notifications'
  return null
}
