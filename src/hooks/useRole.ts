'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'system_admin' | 'company_manager' | 'company_technician' | null

export function useRole() {
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { setLoading(false); return }

        setUserId(user.id)
        const { data, error: prefsErr } = await supabase
          .from('user_preferences')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (prefsErr) {
          console.warn('[useRole] Failed to load role:', prefsErr.message)
        } else if (data?.role) {
          setRole(data.role as UserRole)
        }
      } catch (err) {
        console.error('[useRole] Unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isSystemAdmin = role === 'system_admin'
  const isCompanyManager = role === 'company_manager' || role === 'system_admin'
  const isTechnician = role === 'company_technician'

  return { role, loading, userId, isSystemAdmin, isCompanyManager, isTechnician }
}
