import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Authenticated endpoint: returns companies the current user is authorized to access
export async function GET() {
  try {
    // Verify auth via route handler client
    const authClient = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authErr } = await authClient.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS for reliable queries
    const supabase = getServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get user preferences (role, disabled status)
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('role, is_disabled, company_id')
      .eq('user_id', user.id)
      .single()

    const role = prefs?.role || 'company_technician'

    if (prefs?.is_disabled) {
      return NextResponse.json({ companies: [], role, disabled: true })
    }

    // System admins can access all active companies
    if (role === 'system_admin') {
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('id, name_ar, name_en, description_ar')
        .eq('is_active', true)
        .order('name_ar')

      return NextResponse.json({ companies: allCompanies || [], role })
    }

    // Regular users: try user_companies table first
    let companies: any[] = []
    try {
      const { data: assignments, error: assignErr } = await supabase
        .from('user_companies')
        .select('company:companies(id, name_ar, name_en, description_ar, is_active)')
        .eq('user_id', user.id)

      if (assignErr) throw assignErr

      companies = (assignments || [])
        .map((a: any) => a.company)
        .filter((c: any) => c !== null && c.is_active !== false)
    } catch {
      // Fallback: if user_companies table doesn't exist, use company_id from preferences
      if (prefs?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('id, name_ar, name_en, description_ar')
          .eq('id', prefs.company_id)
          .eq('is_active', true)
          .single()

        if (company) companies = [company]
      }
    }

    // If user_companies returned empty but preferences has a company_id, include it
    if (companies.length === 0 && prefs?.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name_ar, name_en, description_ar')
        .eq('id', prefs.company_id)
        .eq('is_active', true)
        .single()

      if (company) companies = [company]
    }

    return NextResponse.json({ companies, role })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load user companies' }, { status: 500 })
  }
}

// POST: set the user's active company
export async function POST(request: NextRequest) {
  try {
    const authClient = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authErr } = await authClient.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { company_id } = await request.json()
    if (!company_id) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    await supabase
      .from('user_preferences')
      .update({ company_id })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to set company' }, { status: 500 })
  }
}
