'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes of inactivity
const WARNING_BEFORE_MS = 2 * 60 * 1000 // Show warning 2 minutes before logout

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

export function useIdleTimeout() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(async () => {
    clearAllTimers()
    setShowWarning(false)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_selected_company')
    }
    router.push('/login')
  }, [router])

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    timeoutRef.current = null
    warningRef.current = null
    countdownRef.current = null
  }, [])

  const resetTimer = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)

    // Set warning timer (fires 2 min before logout)
    warningRef.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000))
      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS)
  }, [clearAllTimers, logout])

  const dismissWarning = useCallback(() => {
    setShowWarning(false)
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    const handleActivity = () => {
      if (!showWarning) {
        resetTimer()
      }
    }

    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Start the initial timer
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      clearAllTimers()
    }
  }, [resetTimer, clearAllTimers, showWarning])

  return { showWarning, secondsLeft, dismissWarning, logout }
}
