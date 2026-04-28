'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { useRole } from '@/hooks/useRole'
import Link from 'next/link'
import { Receipt, Plus, ListOrdered, Shield } from 'lucide-react'

export default function FormsPage() {
  const { t, language } = useTranslation()
  const { isCompanyManager } = useRole()

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

    </div>
  )
}
