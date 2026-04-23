'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { generatePreventiveInspectionPDF } from '@/lib/pdf/generator'
import { format } from 'date-fns'
import Link from 'next/link'

interface Vehicle {
  id: string
  plate_number: string
  current_odometer: number
  reserve_id: string | null
  driver_id: string | null
  reserve?: { name_ar: string; name_en: string } | null
}

export default function PreventiveInspectionPage() {
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [companyNameAr, setCompanyNameAr] = useState<string | undefined>()
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [formData, setFormData] = useState({
    engineOilLevel: 100,
    radiatorWaterLevel: 100,
    brakeOilLevel: 100,
    tirePressure: 100,
    tireCondition: 'good',
    brakeCondition: 'good',
    frontLights: true,
    rearLights: true,
    turnSignals: true,
    dashboardWarningLights: true,
    engineSound: true,
    steering: true,
    underbody: true,
    safetyEquipment: true,
    spareTire: true,
    tools: true,
    interiorCleanliness: true,
    exteriorCleanliness: true,
  })

  useEffect(() => {
    if (!companyLoading) loadVehicles()
  }, [companyId, companyLoading])

  const loadVehicles = async () => {
    try {
      const supabase = createClient()
      // جلب اسم الشركة لتحديد اللوجو (اختياري - للوضع أحادي المستأجر)
      if (companyId) {
        const { data: company } = await supabase.from('companies').select('name_ar').eq('id', companyId).single()
        if (company) setCompanyNameAr(company.name_ar)
      }

      // Single-tenant workshop model: no company filter on vehicles.
      const query = supabase.from('vehicles').select('*, reserve:reserves(name_ar, name_en)').order('plate_number')
      const { data, error } = await query

      if (error) throw error
      setVehicles(data || [])
    } catch (err: any) {
      console.error('Error loading vehicles:', err)
      setFetchError(err.message || 'Failed to load vehicles')
    } finally {
      setLoadingVehicles(false)
    }
  }

  const handlePrint = () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId)
    if (!vehicle) {
      alert('Please select a vehicle')
      return
    }

    const pdf = generatePreventiveInspectionPDF(
      {
        plateNumber: vehicle.plate_number,
        driverName: '-',
        reserve: vehicle.reserve ? (language === 'ar' ? vehicle.reserve.name_ar : vehicle.reserve.name_en) : '-',
        printDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
        currentOdometer: vehicle.current_odometer,
        ...formData,
      },
      language,
      companyNameAr   // ← اسم الشركة لتحديد اللوجو
    )

    pdf.save(`preventive-inspection-${vehicle.plate_number}.pdf`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t('forms.preventiveInspection')}
      </h1>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-700 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('forms.selectVehicle')}
          </label>
          {fetchError ? (
            <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">{fetchError}</div>
          ) : loadingVehicles ? (
            <div className="text-gray-500 text-sm">{t('common.loading')}</div>
          ) : vehicles.length === 0 ? (
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-2">
                {language === 'ar' ? 'لا توجد مركبات. يرجى إضافة مركبات أولاً' : 'No vehicles found. Please add vehicles first.'}
              </p>
              <Link href="/fleet/add" className="text-red-600 dark:text-red-400 text-sm hover:underline">
                {t('fleet.addVehicle')} →
              </Link>
            </div>
          ) : (
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">-- {t('common.search')} --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.engineOilLevel')} (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.engineOilLevel}
              onChange={(e) => setFormData({ ...formData, engineOilLevel: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.radiatorWaterLevel')} (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.radiatorWaterLevel}
              onChange={(e) => setFormData({ ...formData, radiatorWaterLevel: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.brakeOilLevel')} (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.brakeOilLevel}
              onChange={(e) => setFormData({ ...formData, brakeOilLevel: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.tirePressure')} (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.tirePressure}
              onChange={(e) => setFormData({ ...formData, tirePressure: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.tireCondition')}
            </label>
            <select
              value={formData.tireCondition}
              onChange={(e) => setFormData({ ...formData, tireCondition: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="good">{t('inspection.good')}</option>
              <option value="moderate">{t('inspection.moderate')}</option>
              <option value="notGood">{t('inspection.notGood')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('inspection.brakeCondition')}
            </label>
            <select
              value={formData.brakeCondition}
              onChange={(e) => setFormData({ ...formData, brakeCondition: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="good">{t('inspection.good')}</option>
              <option value="moderate">{t('inspection.moderate')}</option>
              <option value="notGood">{t('inspection.notGood')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            'frontLights',
            'rearLights',
            'turnSignals',
            'dashboardWarningLights',
            'engineSound',
            'steering',
            'underbody',
            'safetyEquipment',
            'spareTire',
            'tools',
            'interiorCleanliness',
            'exteriorCleanliness',
          ].map((field) => (
            <label key={field} className="flex items-center">
              <input
                type="checkbox"
                checked={formData[field as keyof typeof formData] as boolean}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.checked })}
                className="me-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t(`inspection.${field}`)}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handlePrint}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {t('forms.printForm')}
        </button>
      </div>
    </div>
  )
}
