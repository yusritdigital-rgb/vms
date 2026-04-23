import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

let client: ReturnType<typeof createClientComponentClient> | null = null

/**
 * Safe Supabase client.
 * If env vars are missing (template mode), we fall back to harmless placeholder
 * values so the app does not crash on load. Real network calls will simply fail.
 */
export const createClient = () => {
  if (!client) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
    client = createClientComponentClient({ supabaseUrl, supabaseKey })
  }
  return client
}
