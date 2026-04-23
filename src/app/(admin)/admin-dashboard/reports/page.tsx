'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Loader2, Car, ClipboardList, Wrench, Package } from 'lucide-react'

interface CompanyReport {
  vehicleCount: number
  jobCardCount: number
  activeJobCards: number
  deliveredJobCards: number
  sparePartsCount: number
}

export default function AdminReportsPage() {
  const { language } = useTranslation()
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReports() }, [])

  const loadReports = async () => {
    setLoading(true)
    const supabase = createClient()

    const [{ count: vehicleCount }, { count: jobCardCount }, { count: activeJobCards }, { count: deliveredJobCards }, { count: sparePartsCount }] = await Promise.all([
      supabase.from('vehicles').select('*', { count: 'exact', head: true }),
      supabase.from('job_cards').select('*', { count: 'exact', head: true }),
      supabase.from('job_cards').select('*', { count: 'exact', head: true }).in('status', ['received', 'under_repair', 'repaired']),
      supabase.from('job_cards').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabase.from('spare_parts').select('*', { count: 'exact', head: true }),
    ])

    setReport({
      vehicleCount: vehicleCount || 0,
      jobCardCount: jobCardCount || 0,
      activeJobCards: activeJobCards || 0,
      deliveredJobCards: deliveredJobCards || 0,
      sparePartsCount: sparePartsCount || 0,
    })
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'تقارير النظام' : 'System Reports'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {language === 'ar' ? 'إجماليات على مستوى النظام الكامل' : 'System-wide totals'}
        </p>
      </div>

      {!report ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
            <Car className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{report.vehicleCount}</p>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'المركبات' : 'Vehicles'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{report.jobCardCount}</p>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'إجمالي كروت العمل' : 'Total Job Cards'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
            <Wrench className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{report.activeJobCards}</p>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'كروت نشطة' : 'Active Cards'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
            <ClipboardList className="w-6 h-6 text-gray-500 mx-auto mb-3" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{report.deliveredJobCards}</p>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'مسلّمة' : 'Delivered'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
            <Package className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{report.sparePartsCount}</p>
            <p className="text-sm text-gray-500 mt-1">{language === 'ar' ? 'قطع الغيار' : 'Spare Parts'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
