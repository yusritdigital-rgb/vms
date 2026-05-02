'use client'

// =====================================================
// Misuse Registration list — /forms/misuse
// -----------------------------------------------------
// Supervisor-only listing of نماذج سوء الاستخدام /
// تحميل تكلفة الإصلاح. Same visual shape as the invoices
// list page (/forms/invoices/page.tsx).
// =====================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Eye, FileDown, Loader2, FileText, Shield, Trash2, FileSpreadsheet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import {
  type MisuseRegistration,
  type MisuseRegistrationWithItems,
  formatCurrency,
} from '@/lib/misuse/types'
import { generateMisusePDF } from '@/lib/pdf/misuse'
import { askPdfLanguage } from '@/lib/pdf/shared'
import { exportMisuseToExcel } from '@/lib/excel/export'
import { toast } from '@/components/ui/Toast'

export default function MisuseListPage() {
  const router = useRouter()
  const { language } = useTranslation()
  const { role, loading: roleLoading, isCompanyManager } = useRole()
  const { isAdmin } = usePermissions()

  const [rows, setRows] = useState<MisuseRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)

  // Route guard: only supervisors (company_manager + system_admin) may view
  // this module. Normal technicians are redirected away.
  useEffect(() => {
    if (roleLoading) return
    if (!isCompanyManager) router.replace('/forms')
  }, [roleLoading, isCompanyManager, router])

  useEffect(() => {
    if (roleLoading || !isCompanyManager) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('misuse_registrations')
        .select('*')
        .order('registration_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('Load misuse registrations:', error)
        setRows([])
      } else {
        setRows((data as MisuseRegistration[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [roleLoading, isCompanyManager])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r =>
      [r.registration_number, r.plate_number, r.project_name, r.vehicle_type]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(needle))
    )
  }, [rows, q])

  const handleExport = async (mu: MisuseRegistration) => {
    const lang = await askPdfLanguage(language as 'ar' | 'en')
    if (!lang) return
    setExportingId(mu.id)
    try {
      const supabase = createClient()
      const [{ data: labor }, { data: parts }] = await Promise.all([
        supabase.from('misuse_labor_items')
          .select('*').eq('misuse_id', mu.id).order('row_number'),
        supabase.from('misuse_spare_part_items')
          .select('*').eq('misuse_id', mu.id).order('row_number'),
      ])
      generateMisusePDF({
        ...mu,
        labor_items: (labor as any) ?? [],
        spare_part_items: (parts as any) ?? [],
      } as MisuseRegistrationWithItems, lang)
    } catch (e: any) {
      toast.error(e?.message || (language === 'ar' ? 'تعذر تصدير الملف' : 'Export failed'))
    } finally {
      setExportingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا السجل؟' : 'Are you sure you want to delete this record?')) return
    const supabase = createClient()
    const { error } = await supabase.from('misuse_registrations').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(language === 'ar' ? 'تم حذف السجل' : 'Record deleted')
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const handleExcelExport = async () => {
    try {
      const supabase = createClient()
      // Fetch all labor and spare part items
      const [{ data: labor }, { data: parts }] = await Promise.all([
        supabase.from('misuse_labor_items').select('*'),
        supabase.from('misuse_spare_part_items').select('*'),
      ])

      // Group items by misuse_id
      const laborByMisuse: Record<string, any[]> = {}
      const partsByMisuse: Record<string, any[]> = {}
      ;(labor || []).forEach((item: any) => {
        if (!laborByMisuse[item.misuse_id]) {
          laborByMisuse[item.misuse_id] = []
        }
        laborByMisuse[item.misuse_id].push(item)
      })
      ;(parts || []).forEach((item: any) => {
        if (!partsByMisuse[item.misuse_id]) {
          partsByMisuse[item.misuse_id] = []
        }
        partsByMisuse[item.misuse_id].push(item)
      })

      exportMisuseToExcel(rows, laborByMisuse, partsByMisuse)
      toast.success(language === 'ar' ? 'تم تصدير ملف Excel' : 'Excel exported successfully')
    } catch (e: any) {
      toast.error(e?.message || (language === 'ar' ? 'تعذر تصدير ملف Excel' : 'Excel export failed'))
    }
  }

  if (roleLoading || !isCompanyManager) {
    return (
      <div className="p-10 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
      </div>
    )
  }

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'نظام تسجيل حالات سوء الاستخدام' : 'Misuse Registration System'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {language === 'ar'
                ? 'نموذج سوء الاستخدام / تحميل تكلفة الإصلاح — متاح للمشرفين فقط'
                : 'Misuse form / Repair-cost charge — supervisors only'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExcelExport}
            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
          <Link
            href="/forms"
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {language === 'ar' ? 'الرجوع' : 'Back'}
          </Link>
          <Link
            href="/forms/misuse/new"
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'تسجيل جديد' : 'New Misuse'}
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={language === 'ar' ? 'بحث برقم السجل أو اللوحة أو المشروع...' : 'Search by registration #, plate, project...'}
            className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'رقم السجل' : 'Registration #'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'المشروع' : 'Project'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'اللوحة' : 'Plate'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'نوع السيارة' : 'Vehicle Type'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'إجراء' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {language === 'ar' ? 'لا توجد سجلات' : 'No records yet'}
                  </td>
                </tr>
              ) : (
                filtered.map(mu => (
                  <tr key={mu.id} className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{mu.registration_number}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{mu.registration_date}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{mu.project_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{mu.plate_number || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{mu.vehicle_type || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {formatCurrency(Number(mu.total))} <span className="text-xs text-gray-400">ر.س</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/forms/misuse/${mu.id}`)}
                          title={language === 'ar' ? 'عرض' : 'View'}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExport(mu)}
                          disabled={exportingId === mu.id}
                          title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          {exportingId === mu.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(mu.id)}
                            title={language === 'ar' ? 'حذف' : 'Delete'}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
