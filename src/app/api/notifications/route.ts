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

/**
 * GET /api/notifications?company_id=...
 *
 * Hardened: never returns a 5xx. If the service-role key is not
 * configured, or the `notifications` table does not exist, or RLS
 * blocks the read, we return an empty list with a `warning` field.
 * This prevents the header bell from crashing the whole layout.
 */
export async function GET(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { notifications: [], warning: 'service_role_key_not_configured' },
      { status: 200 }
    )
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')
  if (!companyId) {
    return NextResponse.json(
      { notifications: [], warning: 'company_id_missing' },
      { status: 200 }
    )
  }

  try {
    // Auto-delete old (best-effort; ignore errors).
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('notifications').delete().lt('created_at', cutoff)
  } catch { /* swallow */ }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    // PostgREST "undefined_table" = 42P01 — table not yet created.
    const code = (error as any).code as string | undefined
    // eslint-disable-next-line no-console
    console.warn('[api/notifications] GET error:', code, error.message)
    return NextResponse.json(
      { notifications: [], warning: code ?? 'select_failed', message: error.message },
      { status: 200 }
    )
  }

  return NextResponse.json({ notifications: data || [] })
}

// POST: create a notification
export async function POST(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { company_id, type, title_ar, title_en, body_ar, body_en, reference_id } = body

    if (!company_id || !type || !title_ar || !title_en) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Deduplication: skip if same type + reference_id exists for this company in last 24h
    if (reference_id) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('company_id', company_id)
        .eq('type', type)
        .eq('reference_id', reference_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ notification: existing[0], deduplicated: true })
      }
    }

    const { data, error } = await supabase.from('notifications').insert({
      company_id,
      type,
      title_ar,
      title_en,
      body_ar: body_ar || null,
      body_en: body_en || null,
      reference_id: reference_id || null,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ notification: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT: mark notification as read
export async function PUT(request: NextRequest) {
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  try {
    const { id, mark_all, company_id } = await request.json()

    if (mark_all && company_id) {
      await supabase.from('notifications').update({ is_read: true }).eq('company_id', company_id)
    } else if (id) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
