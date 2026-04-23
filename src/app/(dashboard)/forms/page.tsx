'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import Link from 'next/link'
import { FileSpreadsheet, Loader2, FileText, Receipt, Plus, ListOrdered, Shield } from 'lucide-react'
import {
  generatePreventiveInspectionExcel,
  generateDeliveryAfterMaintenanceExcel,
  generateReceptionForMaintenanceExcel,
  generateMobileMaintenanceInventoryExcel,
} from '@/lib/excel/formTemplates'

export default function FormsPage() {
  const { t, language } = useTranslation()
  const { isCompanyManager } = useRole()
  const [exporting, setExporting] = useState<string | null>(null)

  const forms = [
    {
      id: 'preventive-inspection',
      title: t('forms.preventiveInspection'),
      titleEn: 'Preventive Inspection',
      description: language === 'ar' ? 'استمارة الفحص الوقائي للمركبات' : 'Preventive vehicle inspection form',
      href: '/forms/preventive-inspection',
      excelGenerator: generatePreventiveInspectionExcel,
    },
    {
      id: 'delivery-after-maintenance',
      title: t('forms.deliveryAfterMaintenance'),
      titleEn: 'Delivery After Maintenance',
      description: language === 'ar' ? 'استمارة تسليم المركبة بعد الصيانة' : 'Vehicle delivery after maintenance form',
      href: '/forms/delivery-after-maintenance',
      excelGenerator: generateDeliveryAfterMaintenanceExcel,
    },
    {
      id: 'reception-for-maintenance',
      title: t('forms.receptionForMaintenance'),
      titleEn: 'Reception for Maintenance',
      description: language === 'ar' ? 'استمارة استقبال المركبة للصيانة' : 'Vehicle reception for maintenance form',
      href: '/forms/reception-for-maintenance',
      excelGenerator: generateReceptionForMaintenanceExcel,
    },
    {
      id: 'mobile-maintenance-inventory',
      title: t('forms.mobileMaintenanceInventory'),
      titleEn: 'Mobile Maintenance Inventory',
      description: language === 'ar' ? 'استمارة جرد مركبة الصيانة المتنقلة' : 'Mobile maintenance vehicle inventory form',
      href: '/forms/mobile-maintenance-inventory',
      excelGenerator: generateMobileMaintenanceInventoryExcel,
    },
  ]

  const handleExportExcel = async (formId: string, formTitle: string, generator: any) => {
    setExporting(formId)
    try {
      const blob = await generator(language)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${formTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Excel export error:', error)
      alert(language === 'ar' ? 'حدث خطأ أثناء تصدير الملف' : 'Error exporting file')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Internal workshop header (business rule: invoices issued under this name) */}
      <div className="flex items-center gap-3 bg-gradient-to-l from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 border border-red-200 dark:border-red-800 rounded-xl px-5 py-3">
        <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm">
          {language === 'ar' ? 'و.أ' : 'AW'}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight">
            {language === 'ar' ? 'الفاتورة صادرة باسم' : 'Invoice issued by'}
          </p>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'ورشة الأوائل' : 'Al-Awael Workshop'}
          </p>
        </div>
      </div>

      {/* ── Internal Invoices quick-access panel ── */}
      <div className="bg-gradient-to-bl from-red-600 to-red-700 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              {language === 'ar' ? 'نظام الفواتير الداخلي' : 'Internal Invoice System'}
            </h2>
            <p className="text-xs text-white/85 mt-0.5">
              {language === 'ar'
                ? 'إنشاء، عرض، وتصدير فواتير ورشة الأوائل بصيغة PDF عالية الجودة'
                : 'Create, view, and export Al-Awael Workshop invoices as high-quality PDF'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/forms/invoices"
            className="px-3 py-2 text-sm bg-white/15 hover:bg-white/25 rounded-lg inline-flex items-center gap-2 font-medium"
          >
            <ListOrdered className="w-4 h-4" />
            {language === 'ar' ? 'قائمة الفواتير' : 'Invoices List'}
          </Link>
          <Link
            href="/forms/invoices/new"
            className="px-3 py-2 text-sm bg-white text-red-700 hover:bg-red-50 rounded-lg inline-flex items-center gap-2 font-bold"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'فاتورة جديدة' : 'New Invoice'}
          </Link>
        </div>
      </div>

      {/* ── Misuse Registration panel (SUPERVISOR ONLY) ──
          Rendered only for system_admin / company_manager. Normal
          technicians will not see this card at all, and the route
          guards on /forms/misuse/** will also redirect if reached
          directly. */}
      {isCompanyManager && (
        <div className="bg-gradient-to-bl from-slate-900 to-red-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">
                {language === 'ar' ? 'نظام تسجيل حالات سوء الاستخدام' : 'Misuse Registration System'}
              </h2>
              <p className="text-xs text-white/85 mt-0.5">
                {language === 'ar'
                  ? 'نموذج سوء الاستخدام / تحميل تكلفة الإصلاح — متاح للمشرفين فقط'
                  : 'Misuse / Repair-cost charge — supervisors only'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/forms/misuse"
              className="px-3 py-2 text-sm bg-white/15 hover:bg-white/25 rounded-lg inline-flex items-center gap-2 font-medium"
            >
              <ListOrdered className="w-4 h-4" />
              {language === 'ar' ? 'قائمة السجلات' : 'Registrations List'}
            </Link>
            <Link
              href="/forms/misuse/new"
              className="px-3 py-2 text-sm bg-white text-red-700 hover:bg-red-50 rounded-lg inline-flex items-center gap-2 font-bold"
            >
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'تسجيل جديد' : 'New Misuse'}
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {language === 'ar' ? 'نماذج Excel' : 'Excel Templates'}
        </h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {language === 'ar' ? 'تصدير النماذج الفارغة بصيغة Excel' : 'Export empty templates as Excel'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {forms.map((form) => (
          <div
            key={form.id}
            className="bg-white dark:bg-slate-900 p-6 rounded-lg border-2 border-gray-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {form.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {form.description}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href={form.href}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                {language === 'ar' ? 'فتح النموذج' : 'Open Form'}
              </Link>

              <button
                onClick={() => handleExportExcel(form.id, form.titleEn, form.excelGenerator)}
                disabled={exporting === form.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed"
              >
                {exporting === form.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {language === 'ar' ? 'جاري التصدير...' : 'Exporting...'}
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
          {language === 'ar' ? 'ملاحظة هامة' : 'Important Note'}
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>
            {language === 'ar' 
              ? 'ملفات Excel المصدرة فارغة وجاهزة للتعبئة والتعديل' 
              : 'Exported Excel files are empty and ready for editing'}
          </li>
          <li>
            {language === 'ar' 
              ? 'جميع الحقول والتفاصيل موجودة ومنسقة بشكل احترافي' 
              : 'All fields and details are professionally formatted'}
          </li>
          <li>
            {language === 'ar' 
              ? 'يمكن طباعة الملفات مباشرة أو تعبئتها إلكترونياً' 
              : 'Files can be printed directly or filled electronically'}
          </li>
        </ul>
      </div>
    </div>
  )
}
