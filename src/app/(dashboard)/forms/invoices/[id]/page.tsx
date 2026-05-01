'use client'

// =====================================================
// Invoice detail page — /forms/invoices/[id]
// -----------------------------------------------------
// Minimal read-only view. The heavy creation UI stays in
// /forms/invoices/new so this page is just a confirmation +
// PDF export entry-point. Fits the existing design system.
// =====================================================

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, FileDown, ArrowRight, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import {
  type Invoice,
  type InvoiceItem,
  type InvoiceWithItems,
  STATUS_BADGE_CLASS,
  STATUS_LABEL_AR,
  ITEM_TYPE_LABEL_AR,
  formatCurrency,
} from '@/lib/invoices/types'
import { generateInvoicePDF } from '@/lib/pdf/invoice'
import { askPdfLanguage } from '@/lib/pdf/shared'
import { toast } from '@/components/ui/Toast'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { language } = useTranslation()

  const [inv, setInv] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: head }, { data: rows }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id).order('row_number'),
      ])
      if (cancelled) return
      setInv((head as Invoice) ?? null)
      setItems((rows as InvoiceItem[]) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id])

  const handleExport = async () => {
    if (!inv) return
    const lang = await askPdfLanguage()
    if (!lang) return
    setExporting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('full_name')
        .eq('user_id', user?.id)
        .single()
      
      generateInvoicePDF({ ...inv, items } as InvoiceWithItems, lang, prefs?.full_name || undefined)
    } catch (e: any) {
      toast.error(e?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
      </div>
    )
  }

  if (!inv) {
    return (
      <div className="p-10 text-center text-gray-500" dir="rtl">
        لم يتم العثور على الفاتورة.
        <div className="mt-4">
          <button onClick={() => router.push('/forms/invoices')} className="text-red-600 hover:underline">
            ← العودة إلى قائمة الفواتير
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <button onClick={() => router.push('/forms/invoices')} className="hover:text-red-600 inline-flex items-center gap-1">
              <ArrowRight className="w-4 h-4" /> الفواتير
            </button>
            <span>/</span>
            <span>{inv.invoice_number}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {inv.invoice_number}
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[inv.status]}`}>
              {STATUS_LABEL_AR[inv.status]}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/forms/invoices/new`)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" /> فاتورة جديدة
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            تصدير PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="تاريخ الفاتورة" value={inv.invoice_date} />
        <SummaryCard label="نوع الإصلاح"    value={inv.repair_type || '-'} />
        <SummaryCard label="الورشة"          value={inv.workshop_name} />
        <SummaryCard label="المركبة"         value={inv.vehicle_label ? `${inv.vehicle_plate} · ${inv.vehicle_label}` : (inv.vehicle_plate || '-')} />
        <SummaryCard label="مدير الصيانة"    value={inv.maintenance_manager || '-'} />
        <SummaryCard label="الفني المسؤول"   value={inv.technician || '-'} />
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-900 dark:text-white">
          بنود الفاتورة
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <tr>
                <th className="px-3 py-2 text-start">#</th>
                <th className="px-3 py-2 text-start">النوع</th>
                <th className="px-3 py-2 text-start">الوصف</th>
                <th className="px-3 py-2 text-start">الكمية</th>
                <th className="px-3 py-2 text-start">سعر الوحدة</th>
                <th className="px-3 py-2 text-start">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">لا توجد بنود</td></tr>
              ) : (
                items.map((it, i) => (
                  <tr key={it.id ?? i} className="border-t border-gray-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{ITEM_TYPE_LABEL_AR[it.item_type]}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{it.description}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.quantity}</td>
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{formatCurrency(Number(it.unit_price))}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(Number(it.quantity) * Number(it.unit_price))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full md:w-80 bg-gradient-to-bl from-red-50 to-white dark:from-red-900/10 dark:to-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-4 space-y-2">
          <Row label="المجموع قبل الضريبة" value={`${formatCurrency(Number(inv.subtotal))} ر.س`} />
          <Row label={`ضريبة (${inv.vat_percentage}%)`} value={`${formatCurrency(Number(inv.vat_amount))} ر.س`} />
          <div className="pt-2 border-t border-red-200 dark:border-red-900/50 flex justify-between">
            <span className="font-bold text-red-700 dark:text-red-300">الإجمالي</span>
            <span className="font-mono font-extrabold text-red-700 dark:text-red-300 text-lg">
              {formatCurrency(Number(inv.total))} <span className="text-xs text-gray-400">ر.س</span>
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-4">
          <p className="text-xs font-bold text-yellow-700 dark:text-yellow-300 mb-1">ملاحظات</p>
          <p className="text-sm text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}
