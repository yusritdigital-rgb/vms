'use client'

// =====================================================
// Admin → System Settings (simplified).
// -----------------------------------------------------
// Removed:
//   • Per-company feature flags
//   • Homepage hero image uploader
//   • Per-company branding / profile
// Kept:
//   • Danger Zone  (reset all job-card data, system-wide)
// =====================================================

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import {
  Settings, Loader2, Trash2, AlertTriangle, X, CheckCircle,
} from 'lucide-react'

export default function AdminSettingsPage() {
  const { language } = useTranslation()

  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState<{ deleted: number } | null>(null)
  const [resetError, setResetError] = useState('')

  const handleResetData = async () => {
    if (resetConfirmText.trim() !== 'تأكيد') {
      setResetError(language === 'ar' ? 'يجب كتابة "تأكيد" بالضبط للمتابعة' : 'You must type "تأكيد" exactly to proceed')
      return
    }

    setResetting(true)
    setResetError('')
    const supabase = createClient()

    try {
      const { data: cards } = await supabase.from('job_cards').select('id')
      const cardIds = (cards || []).map(c => c.id)

      if (cardIds.length > 0) {
        await supabase.from('job_card_works').delete().in('job_card_id', cardIds)
        await supabase.from('job_card_damages').delete().in('job_card_id', cardIds)
        await supabase.from('job_card_spare_parts').delete().in('job_card_id', cardIds)
        await supabase.from('vehicle_history').delete().in('job_card_id', cardIds)
        await supabase.from('job_cards').delete().in('id', cardIds)
      }

      setResetDone({ deleted: cardIds.length })
      setShowResetModal(false)
      setResetConfirmText('')
    } catch (err: any) {
      setResetError(err?.message || 'حدث خطأ أثناء الحذف')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-red-600" />
          {language === 'ar' ? 'إعدادات النظام' : 'System Settings'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {language === 'ar' ? 'الإعدادات العامة للنظام' : 'Global system settings'}
        </p>
      </div>

      {/* ─── DANGER ZONE ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-red-300 dark:border-red-800 overflow-hidden">
        <div className="px-5 py-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-bold text-red-900 dark:text-red-100">
              {language === 'ar' ? 'منطقة الخطر' : 'Danger Zone'}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              {language === 'ar' ? 'الإجراءات في هذه المنطقة لا يمكن التراجع عنها' : 'Actions here are irreversible'}
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {resetDone && (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                {language === 'ar'
                  ? `تم حذف ${resetDone.deleted} حالة وجميع بياناتها بنجاح. المركبات بقيت سليمة.`
                  : `Successfully deleted ${resetDone.deleted} cases and all related data. Vehicles are intact.`}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {language === 'ar' ? 'تصفير الحالات والبيانات المرتبطة' : 'Reset Cases & Related Data'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {language === 'ar'
                  ? 'يحذف جميع الحالات وبياناتها المرتبطة (أعمال، أضرار، قطع غيار، سجل تحديثات الحالات). المركبات تبقى كما هي.'
                  : 'Deletes all cases and their related data. Vehicles remain untouched.'}
              </p>
            </div>
            <button
              onClick={() => { setShowResetModal(true); setResetConfirmText(''); setResetError(''); setResetDone(null) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {language === 'ar' ? 'تصفير البيانات' : 'Reset Data'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── CONFIRMATION MODAL ──────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-red-300 dark:border-red-700 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <p className="font-bold text-red-900 dark:text-red-100">
                  {language === 'ar' ? 'تأكيد التصفير النهائي' : 'Confirm Data Reset'}
                </p>
              </div>
              <button onClick={() => setShowResetModal(false)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-red-800 dark:text-red-200">
                  {language === 'ar' ? '⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!' : '⚠️ Warning: This action cannot be undone!'}
                </p>
                <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>{language === 'ar' ? 'سيتم حذف جميع الحالات' : 'All cases will be deleted'}</li>
                  <li>{language === 'ar' ? 'سيتم حذف جميع الأعمال والأضرار وقطع الغيار' : 'All works, damages and spare parts will be deleted'}</li>
                  <li>{language === 'ar' ? 'سيتم حذف سجل تحديثات الحالات' : 'Case update history will be deleted'}</li>
                  <li className="font-bold">{language === 'ar' ? 'المركبات لن تُحذف ✓' : 'Vehicles will NOT be deleted ✓'}</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'اكتب كلمة "تأكيد" للمتابعة:' : 'Type "تأكيد" to continue:'}
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => { setResetConfirmText(e.target.value); setResetError('') }}
                  placeholder={language === 'ar' ? 'اكتب: تأكيد' : 'Type: تأكيد'}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:border-red-400 dark:focus:border-red-500 text-sm font-medium transition-colors"
                  dir="rtl"
                />
              </div>

              {resetError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {resetError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleResetData}
                disabled={resetting || resetConfirmText.trim() !== 'تأكيد'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {resetting
                  ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...')
                  : (language === 'ar' ? 'تصفير البيانات نهائياً' : 'Reset Data Permanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
