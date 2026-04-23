'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { Package, Loader2, Search, Building2, AlertTriangle, Trash2, CheckSquare, Square } from 'lucide-react'
import { useAdminContext } from '../AdminContext'

interface SparePart {
  id: string
  name_ar: string
  name_en: string
  part_number: string | null
  stock_quantity: number
  min_stock_level: number
  category?: { name_ar: string; name_en: string } | null
  company?: { name_ar: string; name_en: string } | null
}

export default function AdminSparePartsPage() {
  const { language } = useTranslation()
  const { selectedCompanyId } = useAdminContext()
  const [parts, setParts] = useState<SparePart[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadParts() }, [selectedCompanyId])

  const loadParts = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('spare_parts')
      .select('id, name_ar, name_en, part_number, stock_quantity, min_stock_level, category:spare_part_categories(name_ar, name_en), company:companies(name_ar, name_en)')
      .order('name_ar')
    if (selectedCompanyId) query = query.eq('company_id', selectedCompanyId)
    const { data } = await query
    if (data) setParts(data as any)
    setLoading(false)
  }

  const filtered = parts.filter(p =>
    p.name_ar.toLowerCase().includes(search.toLowerCase()) ||
    p.name_en.toLowerCase().includes(search.toLowerCase()) ||
    (p.part_number && p.part_number.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }
  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!window.confirm(language === 'ar' ? `حذف ${selected.size} قطعة نهائياً؟` : `Permanently delete ${selected.size} part(s)?`)) return
    setDeleting(true)
    const supabase = createClient()
    for (const id of selected) { await supabase.from('spare_parts').delete().eq('id', id) }
    setSelected(new Set()); setDeleting(false); loadParts()
  }
  const deleteSingle = async (id: string, name: string) => {
    if (!window.confirm(language === 'ar' ? `حذف ${name} نهائياً؟` : `Permanently delete ${name}?`)) return
    const supabase = createClient()
    await supabase.from('spare_parts').delete().eq('id', id); loadParts()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'جميع قطع الغيار' : 'All Spare Parts'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? `${parts.length} قطعة` : `${parts.length} parts`}</p>
      </div>
      {selected.size > 0 && (
        <button onClick={deleteSelected} disabled={deleting} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50">
          <Trash2 className="w-4 h-4" />
          {deleting ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? `حذف ${selected.size}` : `Delete ${selected.size}`)}
        </button>
      )}

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
                <th className="px-5 py-3 w-10"><button onClick={toggleAll} className="text-gray-400 hover:text-red-600">{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</button></th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'القطعة' : 'Part'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'رقم القطعة' : 'Part #'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الفئة' : 'Category'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'المخزون' : 'Stock'}</th>
                <th className="text-start px-5 py-3 text-gray-600 dark:text-gray-400 font-medium">{language === 'ar' ? 'الشركة' : 'Company'}</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((p) => {
                const isLow = p.stock_quantity <= p.min_stock_level
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${selected.has(p.id) ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="px-5 py-3"><button onClick={() => toggleSelect(p.id)} className="text-gray-400 hover:text-red-600">{selected.has(p.id) ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4" />}</button></td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{language === 'ar' ? p.name_ar : p.name_en}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.part_number || '-'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.category ? (language === 'ar' ? p.category.name_ar : p.category.name_en) : '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 font-bold ${isLow ? 'text-red-600' : 'text-red-600'}`}>
                        {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {p.company ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full">
                          <Building2 className="w-3 h-3" />
                          {language === 'ar' ? p.company.name_ar : p.company.name_en}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-3"><button onClick={() => deleteSingle(p.id, language === 'ar' ? p.name_ar : p.name_en)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{language === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
