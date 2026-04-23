'use client'

// =====================================================
// Admin Overview — company-agnostic dashboard.
// Stats: Vehicles · Cases · Open · Closed · Workshops · Users
//        · Invoices · Appointments
// =====================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import {
  Car, ClipboardList, CircleDot, CheckCircle2, Wrench,
  Users, Receipt, CalendarClock, Loader2, ChevronRight,
  UserPlus, Upload, FilePlus2, CalendarPlus,
} from 'lucide-react'

interface AdminStats {
  totalVehicles:    number
  totalCases:       number
  openCases:        number
  closedCases:      number
  totalWorkshops:   number
  activeWorkshops:  number
  totalUsers:       number
  totalInvoices:    number
  totalAppointments:number
}

const ZERO: AdminStats = {
  totalVehicles: 0, totalCases: 0, openCases: 0, closedCases: 0,
  totalWorkshops: 0, activeWorkshops: 0, totalUsers: 0,
  totalInvoices: 0, totalAppointments: 0,
}

export default function AdminDashboardPage() {
  const { language } = useTranslation()
  const [stats, setStats]     = useState<AdminStats>(ZERO)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    const supabase = createClient()
    // `safeCount` returns 0 if the table/view doesn't exist (e.g. pre-migration)
    const safeCount = async (q: any): Promise<number> => {
      try { const { count } = await q; return count || 0 } catch { return 0 }
    }

    const [
      totalVehicles, totalCases, openCases, closedCases,
      totalWorkshops, activeWorkshops,
      totalUsers, totalInvoices, totalAppointments,
    ] = await Promise.all([
      safeCount(supabase.from('vehicles').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('job_cards').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('job_cards').select('*', { count: 'exact', head: true }).in('status', ['received', 'under_repair', 'repaired'])),
      safeCount(supabase.from('job_cards').select('*', { count: 'exact', head: true }).eq('status', 'delivered')),
      safeCount(supabase.from('workshops').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('workshops').select('*', { count: 'exact', head: true }).eq('active_status', true)),
      safeCount(supabase.from('user_preferences').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('invoices').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('appointments').select('*', { count: 'exact', head: true })),
    ])

    setStats({
      totalVehicles, totalCases, openCases, closedCases,
      totalWorkshops, activeWorkshops,
      totalUsers, totalInvoices, totalAppointments,
    })
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  const tAr = language === 'ar'

  const cards = [
    { label: tAr ? 'المركبات'        : 'Vehicles',       value: stats.totalVehicles,     sub: tAr ? 'مركبة في النظام'  : 'vehicles',     icon: Car,           href: '/admin-dashboard/vehicles',    color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
    { label: tAr ? 'الحالات'         : 'Cases',          value: stats.totalCases,        sub: tAr ? 'إجمالي'            : 'total',        icon: ClipboardList, href: '/admin-dashboard/job-cards',   color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    { label: tAr ? 'حالات مفتوحة'    : 'Open Cases',     value: stats.openCases,         sub: tAr ? 'قيد المعالجة'      : 'in progress',  icon: CircleDot,     href: '/admin-dashboard/job-cards',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    { label: tAr ? 'حالات مغلقة'     : 'Closed Cases',   value: stats.closedCases,       sub: tAr ? 'مسلّمة'            : 'delivered',    icon: CheckCircle2,  href: '/admin-dashboard/job-cards',   color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    { label: tAr ? 'الورش'           : 'Workshops',      value: stats.totalWorkshops,    sub: tAr ? `${stats.activeWorkshops} نشطة` : `${stats.activeWorkshops} active`, icon: Wrench, href: '/admin-dashboard/workshops', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
    { label: tAr ? 'المستخدمين'      : 'Users',          value: stats.totalUsers,        sub: tAr ? 'مستخدم'            : 'users',        icon: Users,         href: '/admin-dashboard/users',       color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
    { label: tAr ? 'الفواتير'        : 'Invoices',       value: stats.totalInvoices,     sub: tAr ? 'إجمالي الفواتير'   : 'invoices',     icon: Receipt,       href: '/forms/invoices',              color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' },
    { label: tAr ? 'المواعيد'        : 'Appointments',   value: stats.totalAppointments, sub: tAr ? 'موعد مسجل'         : 'scheduled',    icon: CalendarClock, href: '/reserves',                    color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
  ]

  const actions = [
    { label: tAr ? 'إضافة مستخدم'   : 'Add User',          href: '/admin-dashboard/users',     icon: UserPlus },
    { label: tAr ? 'إدارة الورش'    : 'Workshops',         href: '/admin-dashboard/workshops', icon: Wrench },
    { label: tAr ? 'رفع المركبات'   : 'Import Vehicles',   href: '/admin-dashboard/upload',    icon: Upload },
    { label: tAr ? 'إنشاء حالة'     : 'Create Case',       href: '/job-cards',                 icon: ClipboardList },
    { label: tAr ? 'إنشاء فاتورة'   : 'Create Invoice',    href: '/forms/invoices/new',        icon: FilePlus2 },
    { label: tAr ? 'إنشاء موعد'     : 'Create Appointment',href: '/reserves',                  icon: CalendarPlus },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tAr ? 'لوحة تحكم مدير النظام' : 'System Admin Dashboard'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {tAr ? 'نظرة عامة على جميع بيانات النظام' : 'Overview of all system data'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:border-red-400 dark:hover:border-red-600 transition-all hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors rtl:rotate-180" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {tAr ? 'إجراءات سريعة' : 'Quick Actions'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all"
            >
              <action.icon className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
