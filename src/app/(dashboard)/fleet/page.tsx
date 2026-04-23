'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useCompanyId } from '@/hooks/useCompany'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Download, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { exportToCSV } from '@/lib/utils/exportData'
import { debounce } from '@/lib/utils/debounce'

interface Vehicle {
  id: string
  plate_number: string
  chassis_number: string
  brand: string
  model: string
  current_odometer: number
  vehicle_classification: string | null
  driver_id: string | null
}

const PAGE_SIZE_OPTIONS = [5, 10, 50, 100, 0] // 0 = الكل

export default function FleetPage() {
  const { t, language } = useTranslation()
  const { companyId, loading: companyLoading } = useCompanyId()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<'plate_number' | 'brand' | 'model'>('plate_number')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Debounced search
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearch(value)
      setPage(1)
    }, 350),
    []
  )

  useEffect(() => {
    debouncedSetSearch(searchTerm)
  }, [searchTerm, debouncedSetSearch])

  useEffect(() => {
    if (!companyLoading) {
      setPage(1)
    }
  }, [sortBy, sortOrder, pageSize])

  useEffect(() => {
    if (!companyLoading) loadVehicles()
  }, [companyId, companyLoading, debouncedSearch, page, pageSize, sortBy, sortOrder])

  const loadVehicles = async () => {
    setLoading(true)
    const supabase = createClient()

    // Single-tenant workshop model: no company filter so imported vehicles are
    // always visible regardless of their legacy company_id value.
    let query = supabase
      .from('vehicles')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })

    // Server-side search (Arabic plate + manufacturer also matched).
    if (debouncedSearch.trim()) {
      const s = `%${debouncedSearch.trim()}%`
      query = query.or(
        `plate_number.ilike.${s},plate_number_ar.ilike.${s},chassis_number.ilike.${s},brand.ilike.${s},manufacturer.ilike.${s},model.ilike.${s}`
      )
    }

    // Pagination: pageSize = 0 means fetch all
    if (pageSize > 0) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)
    }

    const { data, count, error } = await query
    if (!error) {
      setVehicles(data ?? [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const sortIcon = (col: typeof sortBy) => {
    if (sortBy !== col) return <span className="text-gray-300 ms-1">↕</span>
    return <span className="text-red-500 ms-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  const handleExportAll = async () => {
    // Export without pagination to get all matching rows
    const supabase = createClient()
    let query = supabase
      .from('vehicles')
      .select('*')
      .order(sortBy, { ascending: sortOrder === 'asc' })

    if (debouncedSearch.trim()) {
      const s = `%${debouncedSearch.trim()}%`
      query = query.or(
        `plate_number.ilike.${s},plate_number_ar.ilike.${s},chassis_number.ilike.${s},brand.ilike.${s},manufacturer.ilike.${s},model.ilike.${s}`
      )
    }

    const { data } = await query
    if (data) exportToCSV(data, 'fleet_vehicles')
  }

  const pageSizeLabel = (size: number) =>
    size === 0 ? (language === 'ar' ? 'الكل' : 'All') : String(size)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('fleet.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? `إجمالي المركبات: ${totalCount}` : `Total Vehicles: ${totalCount}`}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportAll}
            disabled={totalCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Export data"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">{language === 'ar' ? 'تصدير' : 'Export'}</span>
          </button>
          <Link
            href="/fleet/add"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('fleet.addVehicle')}
          </Link>
        </div>
      </div>

      {/* Search + Page Size */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`${t('common.search')} (${t('fleet.plateNumber')}, ${t('fleet.chassisNumber')}, ${t('fleet.brand')}, ${t('fleet.model')})`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              aria-label="Search vehicles"
            />
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {language === 'ar' ? 'عرض:' : 'Show:'}
            </span>
            <div className="flex gap-1">
              {PAGE_SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1) }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    pageSize === size
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pageSizeLabel(size)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-lg border border-gray-200 dark:border-slate-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th
                  onClick={() => handleSort('plate_number')}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-red-600 select-none"
                >
                  {t('fleet.plateNumber')} {sortIcon('plate_number')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('fleet.chassisNumber')}
                </th>
                <th
                  onClick={() => handleSort('brand')}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-red-600 select-none"
                >
                  {t('fleet.brand')} {sortIcon('brand')}
                </th>
                <th
                  onClick={() => handleSort('model')}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-red-600 select-none"
                >
                  {t('fleet.model')} {sortIcon('model')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('fleet.currentOdometer')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'ar' ? 'التصنيف' : 'Class'}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {vehicle.plate_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {vehicle.chassis_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {vehicle.brand}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {vehicle.model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {vehicle.current_odometer.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {vehicle.vehicle_classification === 'official' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {language === 'ar' ? 'رسمية' : 'Official'}
                      </span>
                    ) : vehicle.vehicle_classification === 'civilian' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {language === 'ar' ? 'مدنية' : 'Civilian'}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/fleet/${vehicle.id}`}
                      className="text-red-600 dark:text-red-400 hover:underline font-medium"
                    >
                      {t('common.details')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {language === 'ar'
              ? `الصفحة ${page} من ${totalPages} — إجمالي ${totalCount} مركبة`
              : `Page ${page} of ${totalPages} — Total ${totalCount} vehicles`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (page <= 3) pageNum = i + 1
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = page - 2 + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-red-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* All-mode info */}
      {!loading && pageSize === 0 && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">
          {language === 'ar' ? `يعرض جميع ${totalCount} مركبة` : `Showing all ${totalCount} vehicles`}
        </p>
      )}
    </div>
  )
}
