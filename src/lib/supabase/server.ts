import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Safe Supabase server client.
 * Falls back to placeholder values when env vars are missing (template mode).
 */
export const createServerClient = () => {
  const cookieStore = cookies()
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  return createServerComponentClient({ cookies: () => cookieStore }, { supabaseUrl, supabaseKey })
}
