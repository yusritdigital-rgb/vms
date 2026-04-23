'use client'

import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { Clock, LogOut, RefreshCw } from 'lucide-react'

export default function IdleTimeoutWarning() {
  const { showWarning, secondsLeft, dismissWarning, logout } = useIdleTimeout()

  if (!showWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-in fade-in">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
          <div className="flex items-center gap-3 text-white">
            <Clock className="w-6 h-6" />
            <h2 className="text-lg font-bold">انتهاء الجلسة</h2>
          </div>
        </div>

        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>

          <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
            سيتم تسجيل خروجك تلقائياً بسبب عدم النشاط
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-6">
            You will be logged out due to inactivity
          </p>

          <div className="flex gap-3">
            <button
              onClick={dismissWarning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              استمرار
            </button>
            <button
              onClick={logout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              خروج
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
