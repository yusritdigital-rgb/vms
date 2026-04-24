'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { generateDeliveryAfterMaintenancePDF } from '@/lib/pdf/generator'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'

interface JobCard {
  id: string
  job_card_number: string
  created_at: string
  delivered_at: string | null
  entry_odometer: number
  exit_odometer: number | null
  vehicle: {
    plate_number: string
    chassis_number: string
    brand: string
    model: string
    reserve?: { name_ar: string; name_en: string } | null
  }
}

export default function DeliveryAfterMaintenancePage() {
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [selectedJobCardId, setSelectedJobCardId] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!companyLoading && companyId) loadJobCards()
  }, [companyId, companyLoading])

  const loadJobCards = async () => {
    try {
      const supabase = createClient()
      let query = supabase.from('job_cards').select(`
          *,
          vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, chassis_number, brand, model, reserve:reserves(name_ar, name_en))
        `).eq('status', 'delivered').order('created_at', { ascending: false })
      query = query.eq('company_id', companyId!)
      const { data, error } = await query

      if (error) throw error
      setJobCards((data || []) as any)
    } catch (err: any) {
      console.error('Error loading job cards:', err)
      setFetchError(err.message || 'Failed to load job cards')
    } finally {
      setLoadingData(false)
    }
  }

  const handlePrint = () => {
    const jobCard = jobCards.find((jc) => jc.id === selectedJobCardId)
    if (!jobCard) {
      alert('Please select a job card')
      return
    }

    const workshopDuration = jobCard.delivered_at
      ? differenceInDays(new Date(jobCard.delivered_at), new Date(jobCard.created_at))
      : 0

    const pdf = generateDeliveryAfterMaintenancePDF(
      {
        jobCardNumber: jobCard.job_card_number,
        creationDate: format(new Date(jobCard.created_at), 'yyyy-MM-dd'),
        deliveryDate: jobCard.delivered_at ? format(new Date(jobCard.delivered_at), 'yyyy-MM-dd') : '',
        workshopDuration,
        plateNumber: jobCard.vehicle.plate_number,
        chassisNumber: jobCard.vehicle.chassis_number,
        brand: jobCard.vehicle.brand,
        model: jobCard.vehicle.model,
        entryOdometer: jobCard.entry_odometer,
        exitOdometer: jobCard.exit_odometer || 0,
        workArea: jobCard.vehicle.reserve ? (language === 'ar' ? jobCard.vehicle.reserve.name_ar : jobCard.vehicle.reserve.name_en) : '',
        works: [],
        spareParts: [],
      },
      language
    )

    pdf.save(`delivery-${jobCard.job_card_number}.pdf`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t('forms.deliveryAfterMaintenance')}
      </h1>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-700 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('forms.selectJobCard')}
          </label>
          {fetchError ? (
            <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">{fetchError}</div>
          ) : loadingData ? (
            <div className="text-gray-500 text-sm">{t('common.loading')}</div>
          ) : jobCards.length === 0 ? (
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-2">
                {language === 'ar' ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0643\u0631\u0648\u062a \u0639\u0645\u0644 \u0645\u0633\u0644\u0645\u0629' : 'No delivered job cards found.'}
              </p>
            </div>
          ) : (
            <select
              value={selectedJobCardId}
              onChange={(e) => setSelectedJobCardId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">-- {t('common.search')} --</option>
              {jobCards.map((jc) => (
                <option key={jc.id} value={jc.id}>
                  {jc.job_card_number} - {jc.vehicle.plate_number}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedJobCardId && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            {(() => {
              const jobCard = jobCards.find((jc) => jc.id === selectedJobCardId)
              if (!jobCard) return null

              return (
                <div className="space-y-2 text-sm">
                  <p><strong>{t('fleet.plateNumber')}:</strong> {jobCard.vehicle.plate_number}</p>
                  <p><strong>{t('fleet.chassisNumber')}:</strong> {jobCard.vehicle.chassis_number}</p>
                  <p><strong>{t('fleet.brand')}:</strong> {jobCard.vehicle.brand}</p>
                  <p><strong>{t('fleet.model')}:</strong> {jobCard.vehicle.model}</p>
                  <p><strong>{t('jobCards.entryOdometer')}:</strong> {jobCard.entry_odometer.toLocaleString()}</p>
                  <p><strong>{t('jobCards.exitOdometer')}:</strong> {jobCard.exit_odometer?.toLocaleString()}</p>
                </div>
              )
            })()}
          </div>
        )}

        <button
          onClick={handlePrint}
          disabled={!selectedJobCardId}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {t('forms.printForm')}
        </button>
      </div>
    </div>
  )
}
