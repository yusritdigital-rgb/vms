'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePreferencesStore } from '@/lib/stores/usePreferencesStore'

export default function ArabicPage() {
  const router = useRouter()
  const setLanguage = usePreferencesStore((state) => state.setLanguage)
  
  useEffect(() => {
    setLanguage('ar')
    router.push('/dashboard')
  }, [router, setLanguage])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">التبديل إلى العربية...</div>
    </div>
  )
}
