'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, Loader2, Search, Building2, Trash2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { useAdminContext } from '../AdminContext'

interface JobCard {
  id: string
  job_card_number: string
  type: 'accident' | 'mechanical'
  status: string
  created_at: string
  vehicle?: { plate_number: string } | null
  company?: { name_ar: string; name_en: string } | null
}

const statusColors: Record<string, string> = {
  received: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  under_repair: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  repaired: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delivered: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
}

export default function AdminJobCardsPage() {
  const { t, language } = useTranslation()
  const { selectedCompanyId } = useAdminContext()
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadData() }, [selectedCompanyId])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('job_cards')
      .select('id, job_card_number, type, status, created_at, vehicle:vehicles(plate_number), company:companies(name_ar, name_en)')
      .order('created_at', { ascending: false })
    if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId)
    const { data } = await query
    if (data) setJobCards(data as any)
    setLoading(false)
  }

  const filtered = jobCards.filter(jc =>
    jc.job_card_number.toLowerCase().includes(search.toLowerCase()) ||
    jc.vehicle?.plate_number?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(j => j.id)))
  }
  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!window.confirm(language === 'ar' ? `حذف ${selected.size} كرت عمل نهائياً؟` : `Permanently delete ${selected.size} job card(s)?`)) return
    setDeleting(true)
    const supabase = createClient()
    for (const id of selected) { await supabase.from('job_cards').delete().eq('id', id) }
    setSelected(new Set()); setDeleting(false); loadData()
  }
  const deleteSingle = async (id: string, num: string) => {
    if (!window.confirm(language === 'ar' ? `حذف كرت العمل ${num} نهائياً؟` : `Permanently delete job card ${num}?`)) return
    const supabase = createClient()
    await supabase.from('job_cards').delete().eq('id', id); loadData()
  }

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = { received: t('dashboard.received'), under_repair: t('dashboard.underRepair'), repaired: t('dashboard.repaired'), delivered: t('dashboard.delivered') }
    return map[s] || s
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'جميع كروت العمل' : 'All Job Cards'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? `${jobCards.length} كرت عمل` : `${jobCards.length} job cards`}</p>
      </div>
      {selected.size > 0 && (
        <button onClick={deleteSelected} disabled={deleting} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50">
          <Trash2 className="w-4 h-4" />
          {deleting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? `حذف ${selected.size}` : `Delete ${selected.size}`)}
        </button>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder={language === 'ar' ? 'بحث برقم الكرت أو اللوحة...' : 'Search by card number or plate...'} value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-10 pe-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <th className="px-5 py-3 w-10"><button onClick={toggleAll} className="text-gray-400 hover:text-red-600">{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</button></th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'رقم الكرت' : 'Card #'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'المركبة' : 'Vehicle'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الشركة' : 'Company'}</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((jc) => (
                <tr key={jc.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${selected.has(jc.id) ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                  <td className="px-5 py-3"><button onClick={() => toggleSelect(jc.id)} className="text-gray-400 hover:text-red-600">{selected.has(jc.id) ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4" />}</button></td>
                  <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">{jc.job_card_number}</td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{jc.vehicle?.plate_number || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${jc.type === 'accident' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {jc.type === 'accident' ? t('dashboard.accident') : t('dashboard.mechanical')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[jc.status] || ''}`}>{getStatusLabel(jc.status)}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{format(new Date(jc.created_at), 'yyyy-MM-dd')}</td>
                  <td className="px-5 py-3">
                    {jc.company ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full">
                        <Building2 className="w-3 h-3" />
                        {language === 'ar' ? jc.company.name_ar : jc.company.name_en}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-3"><button onClick={() => deleteSingle(jc.id, jc.job_card_number)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{language === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
