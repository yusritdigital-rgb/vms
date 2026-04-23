import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET() {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    // Get all auth users
    const { data: { users }, error } = await supabase.auth.admin.listUsers()
    if (error) throw error

    // Get all user_preferences (track-based; company_id kept for back-compat)
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, full_name, role, track, is_disabled')

    const prefsMap = new Map((prefs || []).map((p: any) => [p.user_id, p]))

    const mapped = users.map(user => {
      const pref: any = prefsMap.get(user.id)
      return {
        id: user.id,
        email: user.email || '',
        full_name: pref?.full_name || null,
        role: pref?.role || 'company_technician',
        track: pref?.track ?? null,
        is_disabled: pref?.is_disabled || false,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        has_preferences: !!pref,
      }
    })

    return NextResponse.json({ users: mapped })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    const { email, password, full_name, role, track } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError

    // Create user_preferences (track-based)
    if (authData.user) {
      await supabase.from('user_preferences').upsert({
        user_id: authData.user.id,
        full_name: full_name || null,
        role: role || 'company_technician',
        track: track || null,   // null = see everything
        is_disabled: false,
      }, { onConflict: 'user_id' })
    }

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create user' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    const { user_id, full_name, role, track, is_disabled } = await request.json()
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const payload: any = {
      user_id,
      full_name: full_name || null,
      role: role || 'company_technician',
      track: track || null,   // null = see everything
      is_disabled: is_disabled ?? false,
    }
    await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Delete preferences then auth user. user_companies kept for back-compat
    // but is harmless to leave behind.
    await supabase.from('user_preferences').delete().eq('user_id', userId)
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 })
  }
}
