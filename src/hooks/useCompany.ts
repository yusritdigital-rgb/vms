'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ADMIN_COMPANY_KEY = 'admin_selected_company'

export function setAdminCompanyOverride(companyId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_COMPANY_KEY, companyId)
  }
}

export function clearAdminCompanyOverride() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_COMPANY_KEY)
  }
}

/**
 * useCompanyId (back-compat shim)
 * --------------------------------
 * The company-based multi-tenant model has been deprecated in favour of the
 * track-based model (see `@/hooks/useTrack`). However, many existing pages
 * still call `.eq('company_id', companyId)` on business tables. To keep those
 * queries working without a large refactor, this hook now returns a stable
 * "shared" company id — the first active company in the `companies` table.
 *
 * In effect the whole app operates as a single-tenant workspace
 * (ورشة الأوائل). When data model is consolidated, callers can drop the
 * `company_id` filter entirely and remove this hook.
 */
export function useCompanyId() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('role')
          .eq('user_id', user.id)
          .single()

        setRole(prefs?.role || null)

        // Admin override (kept for admin-dashboard → dashboard flow)
        const override = typeof window !== 'undefined'
          ? localStorage.getItem(ADMIN_COMPANY_KEY)
          : null
        if (override) {
          setCompanyId(override)
          setLoading(false)
          return
        }

        // Single-tenant: pick the first active company as the shared workspace.
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        setCompanyId(company?.id ?? null)
      } catch (err) {
        console.warn('[useCompanyId] Unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { companyId, loading, isAdmin: role === 'system_admin' }
}
