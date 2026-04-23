'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Shield, Save, X, Edit2, ArrowRightLeft, Calendar } from 'lucide-react'

interface Vehicle {
  id: string
  plate_number: string
  chassis_number: string
  brand: string
  model: string
  year: number | null
  color: string | null
  vehicle_type: string | null
  vehicle_classification: string | null
  is_mobile_maintenance: boolean
  current_odometer: number
  driver_id: string | null
  group_assignment: string | null
  registration_expiry_hijri: string | null
}

interface _UnusedReserve {
  id: string
  name_ar: string
  name_en: string
}

interface Driver {
  id: string
  name_ar: string
  name_en: string
}

export default function VehicleDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!companyLoading && companyId) loadData()
  }, [params.id, companyId, companyLoading])

  const loadData = async () => {
    const supabase = createClient()
    
    let driverQ = supabase.from('drivers').select('*').eq('company_id', companyId!)
    const [vehicleRes, driversRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', params.id).single(),
      driverQ,
    ])

    if (vehicleRes.data) setVehicle(vehicleRes.data)
    if (driversRes.data) setDrivers(driversRes.data)
    
    setLoading(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle) return

    const supabase = createClient()
    const { error } = await supabase
      .from('vehicles')
      .update({
        driver_id: vehicle.driver_id,
        group_assignment: vehicle.group_assignment,
        vehicle_classification: vehicle.vehicle_classification,
      })
      .eq('id', vehicle.id)

    if (!error) {
      setEditing(false)
      loadData()
    }
  }

  if (loading || !vehicle) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600 dark:text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  const assignedDriver = drivers.find((d) => d.id === vehicle.driver_id)

  // حساب المتبقي على انتهاء الاستمارة
  const computeExpiryInfo = (hijri: string | null): { days: number | null; label: string; cls: string } => {
    if (!hijri) return { days: null, label: '—', cls: 'text-gray-400' }
    const match = hijri.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return { days: null, label: hijri, cls: 'text-gray-400' }
    const hy = +match[1], hm = +match[2], hd = +match[3]
    const jd = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385
    const z = jd + 0.5, a = Math.floor(z)
    const alpha = Math.floor((a - 1867216.25) / 36524.25)
    const b = a + 1 + alpha - Math.floor(alpha / 4), c = b + 1524
    const d = Math.floor((c - 122.1) / 365.25), e = Math.floor(365.25 * d), g = Math.floor((c - e) / 30.6001)
    const day = c - e - Math.floor(30.6001 * g)
    const month = g < 13.5 ? g - 1 : g - 13
    const year = month > 2.5 ? d - 4716 : d - 4715
    const expiry = new Date(year, month - 1, day)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const days = Math.floor((expiry.getTime() - now.getTime()) / 86400000)
    if (days < 0) return { days, label: `منتهية منذ ${Math.abs(days)} يوم`, cls: 'text-red-600 font-bold' }
    if (days === 0) return { days, label: 'تنتهي اليوم!', cls: 'text-red-600 font-bold' }
    if (days <= 30) return { days, label: `تتبقى ${days} يوم`, cls: 'text-orange-500 font-semibold' }
    if (days <= 365) return { days, label: `تتبقى ${Math.ceil(days / 30)} شهر`, cls: 'text-yellow-600' }
    return { days, label: `تتبقى ${(days / 365).toFixed(1)} سنة`, cls: 'text-red-600' }
  }
  const expiryInfo = computeExpiryInfo(vehicle.registration_expiry_hijri ?? null)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('fleet.vehicleDetails')}
        </h1>
        <button
          onClick={() => router.push('/fleet')}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
        >
          {t('common.close')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.plateNumber')}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
              {vehicle.plate_number}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.chassisNumber')}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
              {vehicle.chassis_number}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.brand')}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
              {vehicle.brand}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.model')}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
              {vehicle.model}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.currentOdometer')}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
              {vehicle.current_odometer.toLocaleString()}
            </div>
          </div>

          {/* انتهاء الاستمارة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'ar' ? 'انتهاء الاستمارة' : 'Registration Expiry'}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              {vehicle.registration_expiry_hijri ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-gray-900 dark:text-white text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {vehicle.registration_expiry_hijri}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    expiryInfo.days !== null && expiryInfo.days < 0
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : expiryInfo.days !== null && expiryInfo.days <= 30
                        ? 'bg-orange-100 dark:bg-orange-900/30'
                        : expiryInfo.days !== null && expiryInfo.days <= 365
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-red-100 dark:bg-red-900/30'
                  } ${expiryInfo.cls}`}>
                    {expiryInfo.label}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'ar' ? 'تصنيف المركبة' : 'Vehicle Classification'}
            </label>
            {editing ? (
              <select
                value={vehicle.vehicle_classification || ''}
                onChange={(e) => setVehicle({ ...vehicle, vehicle_classification: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">{language === 'ar' ? '-- اختر --' : '-- Select --'}</option>
                <option value="official">{language === 'ar' ? 'رسمية' : 'Official'}</option>
                <option value="civilian">{language === 'ar' ? 'مدنية' : 'Civilian'}</option>
              </select>
            ) : (
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
                {vehicle.vehicle_classification === 'official' ? (language === 'ar' ? 'رسمية' : 'Official') : vehicle.vehicle_classification === 'civilian' ? (language === 'ar' ? 'مدنية' : 'Civilian') : '-'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.assignedDriver')}
            </label>
            {editing ? (
              <select
                value={vehicle.driver_id || ''}
                onChange={(e) => setVehicle({ ...vehicle, driver_id: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">-</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {language === 'ar' ? d.name_ar : d.name_en}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
                {assignedDriver
                  ? language === 'ar'
                    ? assignedDriver.name_ar
                    : assignedDriver.name_en
                  : '-'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('fleet.groupAssignment')}
            </label>
            {editing ? (
              <select
                value={vehicle.group_assignment || ''}
                onChange={(e) => setVehicle({ ...vehicle, group_assignment: e.target.value || null })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">-</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            ) : (
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-900 dark:text-white">
                {vehicle.group_assignment || '-'}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {editing ? (
            <>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  loadData()
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {t('common.edit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
