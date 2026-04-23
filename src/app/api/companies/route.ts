import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public endpoint - returns active companies for login page
// Uses service role key to bypass RLS (anon users can't read companies table without proper policy)
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase
      .from('companies')
      .select('id, name_ar, name_en, description_ar')
      .eq('is_active', true)
      .order('name_ar')

    if (error) throw error

    return NextResponse.json({ companies: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load companies' }, { status: 500 })
  }
}
