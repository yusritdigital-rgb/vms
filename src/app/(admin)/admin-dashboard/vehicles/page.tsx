'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { Car, Loader2, Search, Building2, Trash2, CheckSquare, Square } from 'lucide-react'
import { useAdminContext } from '../AdminContext'

interface Vehicle {
  id: string
  plate_number: string
  chassis_number: string
  brand: string
  model: string
  year: number | null
  current_odometer: number
  company?: { name_ar: string; name_en: string } | null
}

export default function AdminVehiclesPage() {
  const { language } = useTranslation()
  const { selectedCompanyId, selectedCompanyName } = useAdminContext()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadVehicles() }, [selectedCompanyId])

  const loadVehicles = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('vehicles')
      .select('id, plate_number, chassis_number, brand, model, year, current_odometer, company:companies(name_ar, name_en)')
      .order('plate_number')
    if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId)
    const { data } = await query
    if (data) setVehicles(data as any)
    setLoading(false)
  }

  const filtered = vehicles.filter(v =>
    v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    v.brand.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase()) ||
    v.chassis_number.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(v => v.id)))
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    const confirmed = window.confirm(language === 'ar' ? `حذف ${selected.size} مركبة نهائياً؟` : `Permanently delete ${selected.size} vehicle(s)?`)
    if (!confirmed) return
    setDeleting(true)
    const supabase = createClient()
    for (const id of selected) {
      await supabase.from('vehicles').delete().eq('id', id)
    }
    setSelected(new Set())
    setDeleting(false)
    loadVehicles()
  }

  const deleteSingle = async (id: string, plate: string) => {
    const confirmed = window.confirm(language === 'ar' ? `حذف المركبة ${plate} نهائياً؟` : `Permanently delete vehicle ${plate}?`)
    if (!confirmed) return
    const supabase = createClient()
    await supabase.from('vehicles').delete().eq('id', id)
    loadVehicles()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'جميع المركبات' : 'All Vehicles'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? `${vehicles.length} مركبة` : `${vehicles.length} vehicles`}</p>
        </div>
        {selected.size > 0 && (
          <button onClick={deleteSelected} disabled={deleting} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
            {deleting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? `حذف ${selected.size} مركبة` : `Delete ${selected.size}`)}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder={language === 'ar' ? 'بحث...' : 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-10 pe-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <th className="px-5 py-3 w-10">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-red-600">
                    {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'اللوحة' : 'Plate'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'المركبة' : 'Vehicle'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الشاصي' : 'Chassis'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'العداد' : 'Odometer'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الشركة' : 'Company'}</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((v) => (
                <tr key={v.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${selected.has(v.id) ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleSelect(v.id)} className="text-gray-400 hover:text-red-600">
                      {selected.has(v.id) ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">{v.plate_number}</td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{v.brand} {v.model} {v.year || ''}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{v.chassis_number}</td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{v.current_odometer.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    {v.company ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full">
                        <Building2 className="w-3 h-3" />
                        {language === 'ar' ? v.company.name_ar : v.company.name_en}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => deleteSingle(v.id, v.plate_number)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={language === 'ar' ? 'حذف' : 'Delete'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Car className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{language === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
