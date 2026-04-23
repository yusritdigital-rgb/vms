'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Clock, Wrench, Package, Car, AlertTriangle, FileText } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import Link from 'next/link'

interface Notification {
  id: string
  company_id: string
  type: string
  title_ar: string
  title_en: string
  body_ar: string | null
  body_en: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

const typeIcons: Record<string, { Icon: any; color: string }> = {
  new_job_card: { Icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  job_card_delivered: { Icon: CheckCheck, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  vehicle_overdue: { Icon: AlertTriangle, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  low_stock: { Icon: Package, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  vehicle_received: { Icon: Car, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
  general: { Icon: Bell, color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20' },
}

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now'
  if (mins < 60) return lang === 'ar' ? `منذ ${mins} دقيقة` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} ساعة` : `${hrs}h ago`
  return lang === 'ar' ? 'منذ يوم' : '1d ago'
}

export default function NotificationBell() {
  const { language } = useTranslation()
  const { companyId } = useCompanyId()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (companyId) {
      loadNotifications()
      const interval = setInterval(loadNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [companyId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/notifications?company_id=${companyId}`)
      const data = await res.json()
      if (data.notifications) setNotifications(data.notifications)
    } catch {}
  }

  const markAllRead = async () => {
    if (!companyId) return
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true, company_id: companyId }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch {}
  }

  const markRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {}
  }

  const getLink = (n: Notification) => {
    if (n.type === 'new_job_card' || n.type === 'job_card_delivered' || n.type === 'vehicle_overdue' || n.type === 'vehicle_received') {
      return n.reference_id ? `/job-cards/${n.reference_id}` : null
    }
    // `low_stock` was a legacy parts-inventory notification. The Cases
    // workflow no longer tracks inventory, so these notifications no
    // longer deep-link anywhere and simply stay in the bell's list as
    // informational entries.
    return null
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-[360px] bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
              {language === 'ar' ? 'الإشعارات' : 'Notifications'}
            </h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" />
                {language === 'ar' ? 'قراءة الكل' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
              </div>
            ) : (
              notifications.map((n) => {
                const typeInfo = typeIcons[n.type] || typeIcons.general
                const IconComp = typeInfo.Icon
                const link = getLink(n)

                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-red-50/40 dark:bg-red-900/5' : ''}`}
                    onClick={() => { markRead(n.id); if (link) setOpen(false) }}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {language === 'ar' ? n.title_ar : n.title_en}
                        </p>
                        {!n.is_read && <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                      {(n.body_ar || n.body_en) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {language === 'ar' ? n.body_ar : n.body_en}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-[10px] text-gray-400">{timeAgo(n.created_at, language)}</span>
                      </div>
                    </div>
                  </div>
                )

                return link ? (
                  <Link key={n.id} href={link}>{content}</Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <p className="text-[10px] text-gray-400">
              {language === 'ar' ? 'الإشعارات تُحذف تلقائياً بعد 24 ساعة' : 'Notifications auto-delete after 24 hours'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
