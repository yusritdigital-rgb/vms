'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Clock, CheckCircle, AlertTriangle, ArrowRightLeft, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { getUnreadNotifications, markNotificationAsRead, markAllAsRead, deleteNotification } from '@/lib/notifications/queries'
import type { Notification } from '@/lib/notifications/types'
import { NOTIFICATION_LABELS, NOTIFICATION_ICONS } from '@/lib/notifications/types'
import Link from 'next/link'

const typeIcons: Record<string, { Icon: any; color: string }> = {
  case_ready: { Icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
  case_delivered: { Icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
  case_overdue: { Icon: AlertTriangle, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  workshop_transfer: { Icon: ArrowRightLeft, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  other: { Icon: Bell, color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20' },
}

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now'
  if (mins < 60) return lang === 'ar' ? `منذ ${mins} دقيقة` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} ساعة` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return lang === 'ar' ? `منذ ${days} يوم` : `${days}d ago`
}

export default function NotificationBell() {
  const { language } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const notifs = await getUnreadNotifications(user.id)
      setNotifications(notifs)
    } catch (error) {
      console.error('[NotificationBell] loadNotifications failed:', error)
    }
  }

  const markAllRead = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await markAllAsRead(user.id)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.error('[NotificationBell] markAllRead failed:', error)
    }
  }

  const markRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (error) {
      console.error('[NotificationBell] markRead failed:', error)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('[NotificationBell] handleDelete failed:', error)
    }
  }

  const getLink = (n: Notification) => {
    if (n.case_id) {
      return `/job-cards/${n.case_id}`
    }
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
                const typeInfo = typeIcons[n.type] || typeIcons.other
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
                          {n.title}
                        </p>
                        <button
                          onClick={(e) => handleDelete(e, n.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
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
              {language === 'ar' ? 'الإشعارات تُحذف تلقائياً بعد انتهاء صلاحيتها' : 'Notifications auto-delete after expiration'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
