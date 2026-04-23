'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isFullAccessRole } from '@/lib/roles'

export interface UserPermissions {
  dashboard: boolean
  fleet: boolean
  history: boolean
  jobCards: boolean
  spareParts: boolean
  forms: boolean
  reserves: boolean
  settings: boolean
  notifications: boolean
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  fleet: true,
  history: true,
  jobCards: true,
  spareParts: true,
  forms: true,
  reserves: true,
  settings: true,
  notifications: true,
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { setLoading(false); return }

        setUserId(user.id)
        setEmail(user.email || null)

        const { data, error: prefsErr } = await supabase
          .from('user_preferences')
          .select('role, full_name, permissions')
          .eq('user_id', user.id)
          .single()

        if (prefsErr) {
          console.warn('[usePermissions] Failed to load preferences:', prefsErr.message)
          setLoading(false)
          return
        }

        if (data) {
          setRole(data.role)
          setFullName(data.full_name)
          // Both "مدير النظام" (system_admin) and "مشرف" (company_manager)
          // get full access — their per-user permissions override is ignored.
          // "موظف" (company_technician) still respects the override.
          if (isFullAccessRole(data.role)) {
            setPermissions(DEFAULT_PERMISSIONS)
          } else {
            setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.permissions || {}) })
          }
        }
      } catch (err) {
        console.error('[usePermissions] Unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hasPermission = (key: keyof UserPermissions) => {
    if (isFullAccessRole(role)) return true
    return permissions[key] === true
  }

  return {
    permissions,
    role,
    loading,
    userId,
    fullName,
    email,
    isAdmin: role === 'system_admin',
    isManager: role === 'company_manager',
    // Convenience flag — either role has blanket access.
    isFullAccess: isFullAccessRole(role),
    hasPermission,
  }
}
