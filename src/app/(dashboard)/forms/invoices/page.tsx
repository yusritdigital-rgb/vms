'use client'

// =====================================================
// Invoice list page — /forms/invoices
// -----------------------------------------------------
// Matches the style of the existing dashboard tables
// (see @/src/app/(dashboard)/job-cards/page.tsx). Rows:
//   رقم الفاتورة | المركبة | الورشة | النوع | التاريخ | الإجمالي | الحالة | إجراء
// =====================================================

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Eye, Edit3, FileDown, Loader2, Trash2, FileSpreadsheet, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import {
  type Invoice,
  type InvoiceWithItems,
  STATUS_LABEL_AR,
  STATUS_BADGE_CLASS,
  formatCurrency,
} from '@/lib/invoices/types'
import { generateInvoicePDF } from '@/lib/pdf/invoice'
import { askPdfLanguage } from '@/lib/pdf/shared'
import { importFromExcel } from '@/lib/excel/export'
import { exportSingleSheet } from '@/lib/utils/excelExport'
import { toast } from '@/components/ui/Toast'

export default function InvoicesListPage() {
  const router = useRouter()
  const { language } = useTranslation()
  const { isAdmin } = usePermissions()
  const { isCompanyManager } = useRole()
  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('Load invoices:', error)
        // Table may not exist in dev yet; fail soft.
        setRows([])
      } else {
        setRows((data as Invoice[]) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r =>
      [r.invoice_number, r.vehicle_plate, r.vehicle_label, r.workshop_name, r.repair_type]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(needle))
    )
  }, [rows, q])

  const handleExport = async (inv: Invoice) => {
    // Ask the user which language the PDF should be printed in.
    const lang = await askPdfLanguage()
    if (!lang) return
    setExportingId(inv.id)
    try {
      const supabase = createClient()
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('row_number')
      if (error) throw error

      // Get user full name
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('full_name')
        .eq('user_id', user?.id)
        .single()

      generateInvoicePDF({ ...inv, items: items ?? [] } as InvoiceWithItems, lang, prefs?.full_name || undefined)
    } catch (e: any) {
      toast.error(e?.message || (language === 'ar' ? 'تعذر تصدير الملف' : 'Export failed'))
    } finally {
      setExportingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?')) return
    const supabase = createClient()
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(language === 'ar' ? 'تم حذف الفاتورة' : 'Invoice deleted')
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const handleExcelExport = async () => {
    try {
      const supabase = createClient()
      // Fetch all invoice items
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
      if (itemsError) throw itemsError

      // Group items by invoice_id
      const itemsByInvoice: Record<string, any[]> = {}
      ;(items || []).forEach((item: any) => {
        if (!itemsByInvoice[item.invoice_id]) {
          itemsByInvoice[item.invoice_id] = []
        }
        itemsByInvoice[item.invoice_id].push(item)
      })

      // Create export data with items flattened
      const exportData = rows.map(inv => {
        const invItems = itemsByInvoice[inv.id] || []
        const laborItems = invItems.filter((i: any) => i.item_type === 'labor')
        const sparePartItems = invItems.filter((i: any) => i.item_type === 'spare_part')
        
        return {
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          project: inv.project || '',
          vehicle_plate: inv.vehicle_plate || '',
          vehicle_label: inv.vehicle_label || '',
          workshop_name: inv.workshop_name || '',
          repair_type: inv.repair_type || '',
          status: STATUS_LABEL_AR[inv.status],
          subtotal: inv.subtotal,
          vat_percentage: inv.vat_percentage,
          vat_amount: inv.vat_amount,
          total: inv.total,
          labor_count: laborItems.length,
          labor_items: laborItems.map((i: any) => `${i.description} (${i.quantity} × ${i.unit_price})`).join(' | '),
          parts_count: sparePartItems.length,
          parts_items: sparePartItems.map((i: any) => `${i.description} (${i.quantity} × ${i.unit_price})`).join(' | '),
        }
      })

      await exportSingleSheet(
        'الفواتير',
        [
          { header: 'رقم الفاتورة', key: 'invoice_number', width: 18 },
          { header: 'التاريخ', key: 'invoice_date', width: 14 },
          { header: 'المشروع', key: 'project', width: 15 },
          { header: 'رقم اللوحة', key: 'vehicle_plate', width: 14 },
          { header: 'المركبة', key: 'vehicle_label', width: 22 },
          { header: 'الورشة', key: 'workshop_name', width: 20 },
          { header: 'نوع الإصلاح', key: 'repair_type', width: 15 },
          { header: 'الحالة', key: 'status', width: 14 },
          { header: 'المجموع الفرعي', key: 'subtotal', width: 14 },
          { header: 'ضريبة %', key: 'vat_percentage', width: 10 },
          { header: 'قيمة الضريبة', key: 'vat_amount', width: 14 },
          { header: 'الإجمالي', key: 'total', width: 14 },
          { header: 'عدد الأعمال', key: 'labor_count', width: 12 },
          { header: 'الأعمال', key: 'labor_items', width: 40 },
          { header: 'عدد القطع', key: 'parts_count', width: 12 },
          { header: 'قطع الغيار', key: 'parts_items', width: 40 },
        ],
        exportData,
        'invoices',
        { noSummary: true },
      )
      toast.success(language === 'ar' ? 'تم تصدير ملف Excel' : 'Excel exported successfully')
    } catch (e: any) {
      toast.error(e?.message || (language === 'ar' ? 'تعذر تصدير ملف Excel' : 'Excel export failed'))
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const data = await importFromExcel(file)
      console.log('Imported data:', data)
      toast.success(language === 'ar' ? 'تم استيراد الملف بنجاح' : 'File imported successfully')
      // TODO: Process the imported data and create invoices
    } catch (e: any) {
      toast.error(e?.message || (language === 'ar' ? 'تعذر استيراد الملف' : 'Import failed'))
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'الفواتير' : 'Invoices'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'نظام الفواتير الداخلي' : 'Internal invoice system'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {language === 'ar' ? 'استيراد Excel' : 'Import Excel'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleExcelExport}
            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
          </button>
          <Link
            href="/forms/invoices/new"
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'فاتورة جديدة' : 'New Invoice'}
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
            placeholder={language === 'ar' ? 'بحث برقم الفاتورة، اللوحة، الورشة...' : 'Search by invoice #, plate, workshop...'}
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
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'المركبة' : 'Vehicle'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'الورشة' : 'Workshop'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-start font-semibold">{language === 'ar' ? 'إجراء' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {language === 'ar' ? 'لا توجد فواتير' : 'No invoices yet'}
                  </td>
                </tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <div className="font-medium">{inv.vehicle_plate || '-'}</div>
                      {inv.vehicle_label && <div className="text-xs text-gray-400">{inv.vehicle_label}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.workshop_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{inv.repair_type || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{inv.invoice_date}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {formatCurrency(Number(inv.total))} <span className="text-xs text-gray-400">ر.س</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[inv.status]}`}>
                        {STATUS_LABEL_AR[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/forms/invoices/${inv.id}`)}
                          title={language === 'ar' ? 'عرض' : 'View'}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(isCompanyManager || isAdmin) && inv.status === 'draft' && (
                          <button
                            onClick={() => router.push(`/forms/invoices/${inv.id}?edit=1`)}
                            title={language === 'ar' ? 'تعديل' : 'Edit'}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExport(inv)}
                          disabled={exportingId === inv.id}
                          title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          {exportingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(inv.id)}
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
