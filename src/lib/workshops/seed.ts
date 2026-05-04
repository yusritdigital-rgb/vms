// =====================================================
// Workshop master list + Saudi city centroids.
// Mirrors the SQL seed in migration 007. Useful for:
//   • UI fallbacks (dropdowns when DB seed hasn't run yet)
//   • "Re-seed workshops" admin action
//   • Map defaults
// =====================================================

export type CoverageType = 'city' | 'nationwide' | 'nationwide_non_agency'

export interface WorkshopSeed {
  workshop_name_ar: string
  city_ar: string | null
  coverage_type: CoverageType
  is_agency: boolean
  latitude: number | null
  longitude: number | null
}

// City-level coordinates (editable later via the map UI).
export const SAUDI_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'الرياض':          { lat: 24.7136, lng: 46.6753 },
  'جدة':             { lat: 21.4858, lng: 39.1925 },
  'الدمام':          { lat: 26.4207, lng: 50.0888 },
  'الجبيل':          { lat: 27.0174, lng: 49.6251 },
  'الاحساء':         { lat: 25.3647, lng: 49.5878 },
  'المدينة المنورة': { lat: 24.5247, lng: 39.5692 },
  'تبوك':            { lat: 28.3998, lng: 36.5700 },
  'حائل':            { lat: 27.5219, lng: 41.7057 },
  'جيزان':           { lat: 16.8892, lng: 42.5511 },
  'نجران':           { lat: 17.4917, lng: 44.1322 },
  'خميس مشيط':       { lat: 18.3000, lng: 42.7333 },
  'الطائف':          { lat: 21.2703, lng: 40.4158 },
  'القصيم':          { lat: 26.3299, lng: 43.7708 },
}

function city(name: string, cityAr: string): WorkshopSeed {
  const c = SAUDI_CITY_COORDS[cityAr]
  return {
    workshop_name_ar: name,
    city_ar: cityAr,
    coverage_type: 'city',
    is_agency: false,
    latitude:  c?.lat ?? null,
    longitude: c?.lng ?? null,
  }
}

function agency(name: string): WorkshopSeed {
  return {
    workshop_name_ar: name,
    city_ar: null,
    coverage_type: 'nationwide',
    is_agency: true,
    latitude: null,
    longitude: null,
  }
}

function nonAgency(name: string): WorkshopSeed {
  return {
    workshop_name_ar: name,
    city_ar: null,
    coverage_type: 'nationwide_non_agency',
    is_agency: false,
    latitude: null,
    longitude: null,
  }
}

export const WORKSHOP_SEED: WorkshopSeed[] = [
  // Jeddah
  city('افاق الحديثة', 'جدة'),
  city('الاوائل', 'جدة'),
  city('الدوحة', 'جدة'),
  city('ساك', 'جدة'),
  city('نجم المركبة', 'جدة'),

  // Riyadh
  city('الاوائل', 'الرياض'),
  city('السجو', 'الرياض'),
  city('حريص', 'الرياض'),

  // Jubail
  city('الاوائل', 'الجبيل'),

  // Ahsa
  city('التقنية', 'الاحساء'),

  // Khamis Mushait
  city('الجياد الابيض', 'خميس مشيط'),
  city('الذهبية', 'خميس مشيط'),

  // Najran
  city('الجياد الابيض', 'نجران'),

  // Jizan
  city('الجياد الابيض', 'جيزان'),
  city('الذهبية', 'جيزان'),

  // Tabuk
  city('الجياد الابيض', 'تبوك'),
  city('ركن الربيع', 'تبوك'),

  // Dammam
  city('ساك', 'الدمام'),
  city('رؤية', 'الدمام'),
  city('ماهر الابراهيم', 'الدمام'),
  city('المستقبل', 'الدمام'),
  city('اليمنى', 'الدمام'),
  city('حلا الغد', 'الدمام'),

  // Hail
  city('الكثيري', 'حائل'),
  city('كروة', 'حائل'),

  // Qassim
  city('كروة', 'القصيم'),

  // Madinah
  city('نجم المركبة', 'المدينة المنورة'),
  city('برو كار', 'المدينة المنورة'),

  // Taif
  city('لمسات فنان', 'الطائف'),

  // Nationwide agencies
  agency('توكيلات العالمية'),
  agency('الجبر'),
  agency('الجميح'),
  agency('كيا الاهلية'),
  agency('التوكيلات العالمية'),
  agency('نيسان'),
  agency('الوعلان'),
  agency('هلا السعودية'),
  agency('وكالة ايسوزو'),

  // Nationwide non-agency
  nonAgency('بترومين'),
]

export const COVERAGE_LABEL_AR: Record<CoverageType, string> = {
  city: 'مدينة',
  nationwide: 'وكالة حول المملكة',
  nationwide_non_agency: 'حول المملكة',
}

export const COVERAGE_LABEL_EN: Record<CoverageType, string> = {
  city: 'City',
  nationwide: 'Nationwide Agency',
  nationwide_non_agency: 'Nationwide',
}
