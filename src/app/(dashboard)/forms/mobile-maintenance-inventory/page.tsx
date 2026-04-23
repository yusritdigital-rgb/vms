'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { generateMobileMaintenanceInventoryPDF } from '@/lib/pdf/generator'
import { format } from 'date-fns'
import Link from 'next/link'

interface Vehicle {
  id: string
  plate_number: string
  is_mobile_maintenance: boolean
}

export default function MobileMaintenanceInventoryPage() {
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [inventoryType, setInventoryType] = useState<'daily' | 'weekly' | 'monthly' | 'surprise'>('daily')
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!companyLoading) loadVehicles()
  }, [companyId, companyLoading])

  const loadVehicles = async () => {
    try {
      const supabase = createClient()
      // Single-tenant workshop model: no company filter on vehicles.
      const query = supabase.from('vehicles').select('id, plate_number, is_mobile_maintenance').eq('is_mobile_maintenance', true).order('plate_number')
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
      alert('Please select a mobile maintenance vehicle')
      return
    }

    const pdf = generateMobileMaintenanceInventoryPDF(
      {
        plateNumber: vehicle.plate_number,
        date: format(new Date(), 'yyyy-MM-dd'),
        inventoryType,
      },
      language
    )

    pdf.save(`inventory-${vehicle.plate_number}.pdf`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t('forms.mobileMaintenanceInventory')}
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
                {language === 'ar' ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0631\u0643\u0628\u0627\u062a \u0635\u064a\u0627\u0646\u0629 \u0645\u062a\u0646\u0642\u0644\u0629' : 'No mobile maintenance vehicles found.'}
              </p>
              <Link href="/fleet/add" className="text-red-600 dark:text-red-400 text-sm hover:underline">
                {t('fleet.addVehicle')} \u2192
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('forms.inventoryType')}
          </label>
          <div className="flex flex-wrap gap-4">
            {(['daily', 'weekly', 'monthly', 'surprise'] as const).map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="radio"
                  value={type}
                  checked={inventoryType === type}
                  onChange={(e) => setInventoryType(e.target.value as typeof inventoryType)}
                  className="me-2"
                />
                {t(`forms.${type}`)}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={!selectedVehicleId}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {t('forms.printForm')}
        </button>
      </div>
    </div>
  )
}
