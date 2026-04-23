'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react'

interface _UnusedReserve {
  id: string
  name_ar: string
  name_en: string
}

// Saudi plate allowed letters
const SAUDI_PLATE_LETTERS = ['A', 'B', 'D', 'E', 'G', 'H', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z']

export default function AddVehiclePage() {
  const router = useRouter()
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [formData, setFormData] = useState({
    plate_letters: '',
    plate_numbers: '',
    chassis_number: '',
    brand: '',
    model: '',
    year: '',
    color: '',
    vehicle_type: '',
    vehicle_classification: '',
    is_mobile_maintenance: false,
    current_odometer: '0',
  })


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate plate letters (English only, Saudi allowed letters)
    if (!formData.plate_letters) {
      newErrors.plate_letters = language === 'ar' ? 'الحروف مطلوبة' : 'Letters required'
    } else if (!/^[A-Z]+$/.test(formData.plate_letters)) {
      newErrors.plate_letters = language === 'ar' ? 'حروف إنجليزية فقط' : 'English letters only'
    } else {
      const letters = formData.plate_letters.split('')
      const invalidLetters = letters.filter(l => !SAUDI_PLATE_LETTERS.includes(l))
      if (invalidLetters.length > 0) {
        newErrors.plate_letters = language === 'ar' 
          ? `حروف غير مسموحة: ${invalidLetters.join(', ')}`
          : `Invalid letters: ${invalidLetters.join(', ')}`
      }
    }

    // Validate plate numbers
    if (!formData.plate_numbers) {
      newErrors.plate_numbers = language === 'ar' ? 'الأرقام مطلوبة' : 'Numbers required'
    } else if (!/^\d{1,4}$/.test(formData.plate_numbers)) {
      newErrors.plate_numbers = language === 'ar' ? 'أرقام فقط (1-4 أرقام)' : 'Numbers only (1-4 digits)'
    }

    // Validate chassis number
    if (!formData.chassis_number) {
      newErrors.chassis_number = language === 'ar' ? 'رقم الشاصي مطلوب' : 'Chassis number required'
    } else if (formData.chassis_number.length < 17) {
      newErrors.chassis_number = language === 'ar' ? 'رقم الشاصي يجب أن يكون 17 حرف' : 'Chassis must be 17 characters'
    }

    // Validate odometer
    if (parseInt(formData.current_odometer) < 0) {
      newErrors.current_odometer = language === 'ar' ? 'قراءة العداد يجب أن تكون موجبة' : 'Odometer must be positive'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccessMessage('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setErrors({ 
          submit: language === 'ar' 
            ? 'يجب تسجيل الدخول أولاً' 
            : 'You must be logged in to add vehicles'
        })
        setLoading(false)
        return
      }

      const plateNumber = `${formData.plate_letters} ${formData.plate_numbers}`
      
      const { data, error } = await supabase.from('vehicles').insert([
        {
          plate_number: plateNumber,
          chassis_number: formData.chassis_number.toUpperCase(),
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          year: formData.year ? parseInt(formData.year) : null,
          color: formData.color.trim() || null,
          vehicle_type: formData.vehicle_type.trim() || null,
          vehicle_classification: formData.vehicle_classification || null,
          is_mobile_maintenance: formData.is_mobile_maintenance,
          current_odometer: parseInt(formData.current_odometer),
          company_id: companyId,
        },
      ]).select()

      if (error) {
        console.error('Supabase error:', error)
        let errorMessage = error.message
        
        if (error.message.includes('row-level security')) {
          errorMessage = language === 'ar'
            ? 'خطأ في الصلاحيات. يرجى التواصل مع المسؤول.'
            : 'Permission error. Please contact administrator.'
        } else if (error.code === '23505') {
          errorMessage = language === 'ar'
            ? 'رقم اللوحة أو الشاصي موجود مسبقاً'
            : 'Plate number or chassis already exists'
        }
        
        setErrors({ submit: errorMessage })
      } else {
        setSuccessMessage(language === 'ar' ? 'تم إضافة المركبة بنجاح' : 'Vehicle added successfully')
        setTimeout(() => router.push('/fleet'), 1500)
      }
    } catch (error) {
      console.error('Error adding vehicle:', error)
      setErrors({ submit: language === 'ar' ? 'فشل في إضافة المركبة' : 'Failed to add vehicle' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    let processedValue = value

    // Auto-uppercase for plate letters
    if (name === 'plate_letters') {
      processedValue = value.toUpperCase().replace(/[^A-Z]/g, '')
    }
    
    // Numbers only for plate numbers
    if (name === 'plate_numbers') {
      processedValue = value.replace(/[^0-9]/g, '').slice(0, 4)
    }

    // Uppercase chassis number
    if (name === 'chassis_number') {
      processedValue = value.toUpperCase().slice(0, 17)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : processedValue,
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('fleet.addVehicle')}
        </h1>
        <button
          onClick={() => router.push('/fleet')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('common.cancel')}
        </button>
      </div>

      {successMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{successMessage}</p>
        </div>
      )}

      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{errors.submit}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'رقم اللوحة السعودية' : 'Saudi Plate Number'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'الحروف (إنجليزي)' : 'Letters (English)'} *
                </label>
                <input
                  type="text"
                  name="plate_letters"
                  value={formData.plate_letters}
                  onChange={handleChange}
                  required
                  maxLength={3}
                  placeholder="ABC"
                  aria-label="Plate letters"
                  aria-invalid={!!errors.plate_letters}
                  aria-describedby={errors.plate_letters ? 'plate-letters-error' : undefined}
                  className={`w-full px-4 py-2 rounded-lg border ${errors.plate_letters ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'} bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase text-center text-lg font-bold`}
                />
                {errors.plate_letters && (
                  <p id="plate-letters-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.plate_letters}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'الحروف المسموحة: A B D E G H J K L N P Q R S T U V X Y Z' : 'Allowed: A B D E G H J K L N P Q R S T U V X Y Z'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'الأرقام' : 'Numbers'} *
                </label>
                <input
                  type="text"
                  name="plate_numbers"
                  value={formData.plate_numbers}
                  onChange={handleChange}
                  required
                  maxLength={4}
                  placeholder="1234"
                  aria-label="Plate numbers"
                  aria-invalid={!!errors.plate_numbers}
                  aria-describedby={errors.plate_numbers ? 'plate-numbers-error' : undefined}
                  className={`w-full px-4 py-2 rounded-lg border ${errors.plate_numbers ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'} bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-center text-lg font-bold`}
                />
                {errors.plate_numbers && (
                  <p id="plate-numbers-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.plate_numbers}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? '1-4 أرقام' : '1-4 digits'}
                </p>
              </div>
            </div>
            {formData.plate_letters && formData.plate_numbers && (
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border-2 border-red-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {language === 'ar' ? 'معاينة رقم اللوحة:' : 'Plate Preview:'}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                  {formData.plate_letters} {formData.plate_numbers}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.chassisNumber')} *
              </label>
              <input
                type="text"
                name="chassis_number"
                value={formData.chassis_number}
                onChange={handleChange}
                required
                maxLength={17}
                placeholder="17 characters VIN"
                aria-label="Chassis number"
                aria-invalid={!!errors.chassis_number}
                aria-describedby={errors.chassis_number ? 'chassis-error' : undefined}
                className={`w-full px-4 py-2 rounded-lg border ${errors.chassis_number ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'} bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase font-mono`}
              />
              {errors.chassis_number && (
                <p id="chassis-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.chassis_number}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.chassis_number.length}/17 {language === 'ar' ? 'حرف' : 'characters'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.brand')} *
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.model')} *
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.year')}
              </label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                min="1900"
                max="2100"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.color')}
              </label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.vehicleType')}
              </label>
              <input
                type="text"
                name="vehicle_type"
                value={formData.vehicle_type}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'تصنيف المركبة' : 'Vehicle Classification'}
              </label>
              <select
                name="vehicle_classification"
                value={formData.vehicle_classification}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">{language === 'ar' ? '-- اختر --' : '-- Select --'}</option>
                <option value="official">{language === 'ar' ? 'رسمية' : 'Official'}</option>
                <option value="civilian">{language === 'ar' ? 'مدنية' : 'Civilian'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fleet.currentOdometer')} *
              </label>
              <input
                type="number"
                name="current_odometer"
                value={formData.current_odometer}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_mobile_maintenance"
              id="is_mobile_maintenance"
              checked={formData.is_mobile_maintenance}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-red-600 focus:ring-red-500"
            />
            <label
              htmlFor="is_mobile_maintenance"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              سيارة صيانة متنقلة / Mobile Maintenance Vehicle
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/fleet')}
              className="px-6 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-5 h-5" />
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
