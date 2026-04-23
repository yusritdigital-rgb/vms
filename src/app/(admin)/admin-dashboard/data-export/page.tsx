'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { Download, Loader2, Car, ClipboardList, Package, Users, Building2, Shield, FileSpreadsheet } from 'lucide-react'

const exportTypes = [
  { key: 'vehicles', table: 'vehicles', label: 'المركبات', labelEn: 'Vehicles', icon: Car, select: '*' },
  { key: 'job_cards', table: 'job_cards', label: 'كروت العمل', labelEn: 'Job Cards', icon: ClipboardList, select: '*' },
  { key: 'spare_parts', table: 'spare_parts', label: 'قطع الغيار', labelEn: 'Spare Parts', icon: Package, select: '*' },
  { key: 'users', table: 'user_preferences', label: 'المستخدمين', labelEn: 'Users', icon: Users, select: 'user_id, full_name, role, company_id, is_disabled' },
  { key: 'companies', table: 'companies', label: 'الشركات', labelEn: 'Companies', icon: Building2, select: '*' },
  { key: 'reserves', table: 'reserves', label: 'المحميات', labelEn: 'Reserves', icon: Shield, select: '*' },
]

function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }).join(','))
  ]
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataExportPage() {
  const { language } = useTranslation()
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleExport = async (exp: typeof exportTypes[0]) => {
    setDownloading(exp.key)
    const supabase = createClient()
    const { data } = await supabase.from(exp.table).select(exp.select)
    if (data && data.length > 0) {
      downloadCSV(data, exp.key)
    } else {
      alert(language === 'ar' ? 'لا توجد بيانات للتحميل' : 'No data to export')
    }
    setDownloading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {language === 'ar' ? 'تحميل البيانات' : 'Data Export'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {language === 'ar' ? 'تحميل بيانات النظام بصيغة CSV' : 'Download system data as CSV files'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportTypes.map((exp) => (
          <div key={exp.key} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <exp.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? exp.label : exp.labelEn}</p>
                <p className="text-xs text-gray-500">{exp.table}</p>
              </div>
            </div>
            <button
              onClick={() => handleExport(exp)}
              disabled={downloading === exp.key}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {downloading === exp.key ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري التحميل...' : 'Downloading...'}</>
              ) : (
                <><Download className="w-4 h-4" /> {language === 'ar' ? 'تحميل CSV' : 'Download CSV'}</>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-5 h-5 text-gray-500" />
          <p className="font-medium text-gray-900 dark:text-white">{language === 'ar' ? 'ملاحظة' : 'Note'}</p>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {language === 'ar'
            ? 'جميع البيانات يتم تحميلها مباشرة من قاعدة البيانات. الملفات بصيغة CSV ويمكن فتحها بواسطة Excel.'
            : 'All data is downloaded directly from the database. Files are in CSV format and can be opened with Excel.'}
        </p>
      </div>
    </div>
  )
}
