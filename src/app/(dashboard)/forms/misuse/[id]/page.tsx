'use client'

// =====================================================
// Misuse Registration detail — /forms/misuse/[id]
// Supervisor-only view with PDF export.
// =====================================================

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, FileDown, Loader2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import { toast } from '@/components/ui/Toast'
import { generateMisusePDF } from '@/lib/pdf/misuse'
import { askPdfLanguage } from '@/lib/pdf/shared'
import {
  type MisuseRegistration,
  type MisuseLaborItem,
  type MisuseSparePartItem,
  type MisuseRegistrationWithItems,
  formatCurrency,
} from '@/lib/misuse/types'

export default function MisuseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const id = String(params.id)
  const { loading: roleLoading, isCompanyManager } = useRole()

  const [mu, setMu]     = useState<MisuseRegistration | null>(null)
  const [labor, setLabor] = useState<MisuseLaborItem[]>([])
  const [parts, setParts] = useState<MisuseSparePartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Supervisor-only
  useEffect(() => {
    if (roleLoading) return
    if (!isCompanyManager) router.replace('/forms')
  }, [roleLoading, isCompanyManager, router])

  useEffect(() => {
    if (roleLoading || !isCompanyManager) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: parent }, { data: l }, { data: p }] = await Promise.all([
        supabase.from('misuse_registrations').select('*').eq('id', id).single(),
        supabase.from('misuse_labor_items').select('*').eq('misuse_id', id).order('row_number'),
        supabase.from('misuse_spare_part_items').select('*').eq('misuse_id', id).order('row_number'),
      ])
      if (cancelled) return
      setMu((parent as MisuseRegistration) ?? null)
      setLabor((l as any) ?? [])
      setParts((p as any) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, roleLoading, isCompanyManager])

  const handleExport = async () => {
    if (!mu) return
    const lang = await askPdfLanguage(language as 'ar' | 'en')
    if (!lang) return
    setExporting(true)
    try {
      generateMisusePDF({ ...mu, labor_items: labor, spare_part_items: parts } as MisuseRegistrationWithItems, lang)
    } catch (e: any) {
      toast.error(e?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (roleLoading || !isCompanyManager || loading) {
    return (
      <div className="p-10 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin inline-block" />
      </div>
    )
  }

  if (!mu) {
    return (
      <div className="p-10 text-center text-gray-500" dir="rtl">
        لم يتم العثور على السجل.
        <div className="mt-4">
          <button onClick={() => router.push('/forms/misuse')} className="text-red-600 hover:underline">
            ← العودة إلى القائمة
          </button>
        </div>
      </div>
    )
  }

  const cardCls = 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden'

  return (
    <div className="space-y-5 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/forms/misuse')} className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{mu.registration_number}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{mu.registration_date}</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {isAr ? 'تصدير PDF' : 'Export PDF'}
        </button>
      </div>

      {/* Basic info */}
      <div className={`${cardCls} p-5`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-xs text-gray-500">{isAr ? 'المشروع' : 'Project'}</div><div className="font-semibold">{mu.project_name || '-'}</div></div>
          <div><div className="text-xs text-gray-500">{isAr ? 'نوع السيارة' : 'Vehicle type'}</div><div className="font-semibold">{mu.vehicle_type || '-'}</div></div>
          <div><div className="text-xs text-gray-500">{isAr ? 'اللوحة' : 'Plate'}</div><div className="font-mono font-bold" dir="ltr">{mu.plate_number || '-'}</div></div>
        </div>
      </div>

      {/* Labor */}
      <div className={cardCls}>
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-xs font-bold text-red-700 dark:text-red-400 uppercase">
          {isAr ? 'الأعمال' : 'Labor'}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{isAr ? 'الوصف' : 'Description'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'التكلفة' : 'Cost'}</th>
            </tr>
          </thead>
          <tbody>
            {labor.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">—</td></tr>
            ) : labor.map((l, i) => (
              <tr key={l.id || i} className="border-t border-gray-100 dark:border-slate-800">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-end font-mono">{formatCurrency(Number(l.cost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Parts */}
      <div className={cardCls}>
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-xs font-bold text-red-700 dark:text-red-400 uppercase">
          {isAr ? 'قطع الغيار' : 'Spare parts'}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-start">#</th>
              <th className="px-3 py-2 text-start">{isAr ? 'القطعة' : 'Part'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'سعر الوحدة' : 'Unit'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'المجموع' : 'Line'}</th>
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">—</td></tr>
            ) : parts.map((p, i) => (
              <tr key={p.id || i} className="border-t border-gray-100 dark:border-slate-800">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">{p.part_name}</td>
                <td className="px-3 py-2 text-end font-mono">{formatCurrency(Number(p.quantity))}</td>
                <td className="px-3 py-2 text-end font-mono">{formatCurrency(Number(p.unit_price))}</td>
                <td className="px-3 py-2 text-end font-mono">{formatCurrency(Number(p.quantity) * Number(p.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className={`${cardCls} p-5`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-sm">
            <div className="text-xs text-gray-500 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</div>
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{mu.notes || '—'}</div>
          </div>
          <div className="border border-red-200 dark:border-red-900/40 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
              <div className="flex justify-between px-4 py-2"><span className="text-gray-500">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span><span className="font-mono">{formatCurrency(Number(mu.subtotal))} ر.س</span></div>
              <div className="flex justify-between px-4 py-2"><span className="text-gray-500">{isAr ? 'الخصم' : 'Discount'} ({Number(mu.discount_percentage)}%)</span><span className="font-mono">{formatCurrency(Number(mu.discount_amount))} ر.س</span></div>
              <div className="flex justify-between px-4 py-2"><span className="text-gray-500">{isAr ? 'الضريبة' : 'VAT'} ({Number(mu.vat_percentage)}%)</span><span className="font-mono">{formatCurrency(Number(mu.vat_amount))} ر.س</span></div>
              <div className="flex justify-between px-4 py-3 bg-red-600 text-white font-bold"><span>{isAr ? 'الإجمالي' : 'Total'}</span><span className="font-mono">{formatCurrency(Number(mu.total))} ر.س</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
