// =====================================================
// User roles — single source of truth for UI labels and
// access-level gating.
// -----------------------------------------------------
// DB values are UNCHANGED (so existing user_preferences
// rows, RLS policies, and JWTs keep working). Only the
// UI labels and the permission bypass have changed:
//
//   system_admin        → "مدير النظام" / "System Admin"
//        Full app access + admin-dashboard access.
//   company_manager     → "مشرف"        / "Supervisor"
//        Full app access (same as system_admin).
//        No admin-dashboard access.
//   company_technician  → "موظف"        / "Employee"
//        Limited operational access (per-user permissions).
//
// Legacy labels ("مدير شركة", "فني", "Technician",
// "Company Manager") have been removed from the UI.
// =====================================================

export type UserRole = 'system_admin' | 'company_manager' | 'company_technician'

/** The three roles users may be assigned, in UI display order. */
export const USER_ROLES: readonly UserRole[] = [
  'system_admin',
  'company_manager',
  'company_technician',
] as const

export interface RoleInfo {
  id: UserRole
  ar: string
  en: string
  /** Tailwind classes for the badge pill used on the Users page. */
  badgeColor: string
}

export const ROLE_INFO: Record<UserRole, RoleInfo> = {
  system_admin: {
    id: 'system_admin',
    ar: 'مدير النظام',
    en: 'System Admin',
    badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  company_manager: {
    id: 'company_manager',
    ar: 'مشرف',
    en: 'Supervisor',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  company_technician: {
    id: 'company_technician',
    ar: 'موظف',
    en: 'Employee',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

/** Lookup helper — falls back to "موظف / Employee" for unknown values. */
export function getRoleInfo(role: string | null | undefined): RoleInfo {
  if (role && role in ROLE_INFO) return ROLE_INFO[role as UserRole]
  return ROLE_INFO.company_technician
}

/**
 * Roles that bypass every feature permission check. Both the system
 * admin and the new "مشرف" (supervisor) have admin-level app access.
 */
export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === 'system_admin' || role === 'company_manager'
}
