'use client'

import { usePreferencesStore } from '@/lib/stores/usePreferencesStore'
import { translations } from '@/lib/i18n/translations'

export function useTranslation() {
  const language = usePreferencesStore((state) => state.language)
  
  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[language]
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key
      }
    }
    
    return typeof value === 'string' ? value : key
  }
  
  return { t, language, isRTL: language === 'ar' }
}
