// =====================================================
// VMS - Case status list
// -----------------------------------------------------
// There is intentionally NO enforced order between
// statuses. A case can move freely between any two
// statuses, e.g. maintenance → paint → maintenance.
// =====================================================

/** All allowed case statuses (Arabic labels = canonical values). */
export const CASE_STATUSES = [
  'بانتظار تقدير',
  'بانتظار تحديد النسبة',
  'بانتظار موافقة العميل على الاصلاح',
  'بانتظار اعتماد مدير الصيانة',
  'بانتظار عرض سعر الورشة (اصلاح)',
  'بانتظار عرض سعر القطع',
  'بانتظار قطع الغيار',
  'تحت الفحص',
  'تحت الاصلاح الميكانيكي',
  'تحت اصلاح الهيكل',
  'تحت الدهان',
  'جاهزة',
  'خسارة كلية',
  'بانتظار عرض البيع',
  'بانتظار اعتماد البيع',
  'بانتظار البيع',
  'تم البيع',
  'تم التسليم للعميل',
  'انتظار موافقة التامين',
  'انتظار خطاب التحويل',
  'محول شؤون قانونية',
  'السيارة في الوكالة',
] as const

export type CaseStatus = typeof CASE_STATUSES[number]

/** Statuses that count as "case is closed" (terminal from a business POV). */
export const CLOSED_STATUSES: readonly CaseStatus[] = [
  'تم التسليم للعميل',
  'تم البيع',
  'خسارة كلية',
]

export function isCaseClosed(status: string | null | undefined): boolean {
  if (!status) return false
  return (CLOSED_STATUSES as readonly string[]).includes(status)
}

/** Optional colour hints for UI badges. Kept loose — the exact grouping
 *  is not a workflow constraint, only visual aid. */
export const STATUS_COLOR: Record<CaseStatus, string> = {
  'بانتظار تقدير':                       'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  'بانتظار تحديد النسبة':                 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  'بانتظار موافقة العميل على الاصلاح':    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'بانتظار اعتماد مدير الصيانة':         'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'بانتظار عرض سعر الورشة (اصلاح)':      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'بانتظار عرض سعر القطع':                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'بانتظار قطع الغيار':                   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'تحت الفحص':                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'تحت الاصلاح الميكانيكي':              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'تحت اصلاح الهيكل':                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'تحت الدهان':                           'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'جاهزة':                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'خسارة كلية':                           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'بانتظار عرض البيع':                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'بانتظار اعتماد البيع':                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'بانتظار البيع':                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'تم البيع':                             'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'تم التسليم للعميل':                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'انتظار موافقة التامين':                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'انتظار خطاب التحويل':                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'محول شؤون قانونية':                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'السيارة في الوكالة':                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}
