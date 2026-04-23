'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Track, Section, canView, canEdit, getAccess } from '@/lib/tracks/accessMatrix'

/**
 * useTrack
 * ---------
 * Replaces the old company-based permissions. Reads `track` from
 * `user_preferences` and exposes helpers for checking access.
 *
 * A system_admin always gets full access (track is effectively null/both).
 */
export function useTrack() {
  const [track, setTrack] = useState<Track>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
          .from('user_preferences')
          .select('track, role')
          .eq('user_id', user.id)
          .single()

        if (data) {
          setTrack((data.track as Track) ?? null)
          setRole(data.role ?? null)
        }
      } catch (e) {
        console.warn('[useTrack] failed to load user track', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // System admins see everything, same as users with no track.
  const effectiveTrack: Track = role === 'system_admin' ? null : track

  return {
    track: effectiveTrack,
    rawTrack: track,
    role,
    loading,
    isAdmin: role === 'system_admin',
    canView: (section: Section) => canView(effectiveTrack, section),
    canEdit: (section: Section) => canEdit(effectiveTrack, section),
    getAccess: (section: Section) => getAccess(effectiveTrack, section),
  }
}
