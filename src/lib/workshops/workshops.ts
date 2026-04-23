// =====================================================
// VMS - Workshop master list (constant source of truth)
// -----------------------------------------------------
// This list is stored as a typed constant so the UI can use it today
// without a DB migration. When the business is ready we can move this
// into a `workshops` table; the ids below are stable slugs that will
// carry over unchanged.
//
// Coverage types:
//   - 'city'                   : single-city shop (e.g. الاوائل — الرياض)
//   - 'nationwide'             : agency with country-wide coverage
//                                (matched by "وكالة حول المملكة")
//   - 'nationwide_non_agency'  : country-wide, not agency
//                                (matched by "حول المملكة" WITHOUT وكالة)
// =====================================================

export type WorkshopCoverage = 'city' | 'nationwide' | 'nationwide_non_agency'

export interface Workshop {
  id: string
  name_ar: string
  city_ar: string
  coverage_type: WorkshopCoverage
  is_agency: boolean
  /** Combined label used in selectors, e.g. "الاوائل — جدة". */
  display_label: string
}

/** Build a deterministic slug-like id from name + city (ASCII-safe). */
function slug(name: string, city: string): string {
  return `${name}__${city}`
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .toLowerCase()
}

/** Factory that normalises coverage rules from the business spec. */
function w(name_ar: string, city_ar: string): Workshop {
  // Rule 1: "وكالة حول المملكة" → nationwide, is_agency = true
  // Rule 2: "حول المملكة"          → nationwide_non_agency, is_agency = false
  // Rule 3: any real city name     → city, is_agency = false
  let coverage_type: WorkshopCoverage = 'city'
  let is_agency = false

  const cityTrim = city_ar.trim()
  if (cityTrim === 'وكالة حول المملكة') {
    coverage_type = 'nationwide'
    is_agency = true
  } else if (cityTrim === 'حول المملكة') {
    coverage_type = 'nationwide_non_agency'
    is_agency = false
  }

  return {
    id: slug(name_ar, city_ar),
    name_ar,
    city_ar: cityTrim,
    coverage_type,
    is_agency,
    display_label: `${name_ar} — ${cityTrim}`,
  }
}

export const WORKSHOPS: readonly Workshop[] = [
  w('افاق الحديثة',       'جدة'),
  w('الاوائل',            'الرياض'),
  w('الاوائل',            'جدة'),
  w('الاوائل',            'الجبيل'),
  w('التقنية',            'الاحساء'),
  w('توكيلات العالمية',   'وكالة حول المملكة'),
  w('الجبر',              'وكالة حول المملكة'),
  w('الجميح',             'وكالة حول المملكة'),
  w('الجياد الابيض',      'خميس مشيط'),
  w('الجياد الابيض',      'نجران'),
  w('الجياد الابيض',      'جيزان'),
  w('الجياد الابيض',      'تبوك'),
  w('الدوحة',             'جدة'),
  w('الذهبية',            'جيزان'),
  w('الذهبية',            'خميس مشيط'),
  w('السجو',              'الرياض'),
  w('ساك',                'جدة'),
  w('ساك',                'الدمام'),
  w('الكثيري',            'حائل'),
  w('رؤية',               'الدمام'),
  w('ماهر الابراهيم',     'الدمام'),
  w('المستقبل',           'الدمام'),
  w('نجم المركبة',        'المدينة المنورة'),
  w('نجم المركبة',        'جدة'),
  w('كيا الاهلية',        'وكالة حول المملكة'),
  w('التوكيلات العالمية', 'وكالة حول المملكة'),
  w('نيسان',              'وكالة حول المملكة'),
  w('برو كار',            'المدينة المنورة'),
  w('اليمنى',             'الدمام'),
  w('ركن الربيع',         'تبوك'),
  w('الوعلان',            'وكالة حول المملكة'),
  w('بترومين',            'حول المملكة'),
  w('لمسات فنان',         'الطائف'),
  w('حلا الغد',           'الدمام'),
  w('هلا السعودية',       'وكالة حول المملكة'),
  w('حريص',               'الرياض'),
]

export function findWorkshopById(id: string): Workshop | undefined {
  return WORKSHOPS.find(w => w.id === id)
}
