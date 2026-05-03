'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { createClient } from '@/lib/supabase/client'
import { Loader2, MapPin, Layers } from 'lucide-react'

interface WorkshopWithCounts {
  id: string
  workshop_name_ar: string
  city_ar: string | null
  latitude: number
  longitude: number
  total_cases: number
  open_cases: number
  closed_cases: number
  delayed_cases: number
}

interface WorkshopsMapProps {
  language?: 'ar' | 'en'
}

// Custom marker icon with badges for case counts
const getMarkerIcon = (openCases: number, delayedCases: number) => {
  const hasCases = openCases > 0 || delayedCases > 0
  
  return L.divIcon({
    className: 'custom-workshop-marker',
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 32px;
          height: 32px;
          background: ${hasCases ? '#6b7280' : '#9ca3af'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        ${openCases > 0 ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            background: #0d9488;
            color: white;
            font-size: 10px;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          ">
            ${openCases}
          </div>
        ` : ''}
        ${delayedCases > 0 ? `
          <div style="
            position: absolute;
            bottom: -2px;
            left: -2px;
            background: #dc2626;
            color: white;
            font-size: 10px;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          ">
            ${delayedCases}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

export default function WorkshopsMap({ language = 'ar' }: WorkshopsMapProps) {
  const [workshops, setWorkshops] = useState<WorkshopWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers')

  const isAr = language === 'ar'

  useEffect(() => {
    const loadWorkshops = async () => {
      try {
        const supabase = createClient()
        
        // Load workshops with case counts from the view
        const [{ data: workshopsData, error: workshopsError }, { data: countsData }] = await Promise.all([
          supabase
            .from('workshops')
            .select('id, workshop_name_ar, city_ar, latitude, longitude')
            .eq('active_status', true),
          supabase
            .from('v_workshop_case_counts')
            .select('workshop_id, total_cases, open_cases, closed_cases'),
        ])

        if (workshopsError) {
          console.error('[WorkshopsMap] workshops load failed', workshopsError)
          setError(isAr ? 'فشل تحميل بيانات الورش' : 'Failed to load workshops data')
          return
        }

        // Create a map of workshop_id -> counts
        const countsMap = new Map<string, { total_cases: number; open_cases: number; closed_cases: number }>()
        if (countsData) {
          for (const cc of countsData) {
            countsMap.set(cc.workshop_id, {
              total_cases: cc.total_cases,
              open_cases: cc.open_cases,
              closed_cases: cc.closed_cases,
            })
          }
        }

        // Load job cards to calculate delayed cases (> 3 days old and still open).
        // We key by (workshop_name|workshop_city) — NOT workshop_id — because
        // job_cards.workshop_id stores a slug ("الاوائل__الرياض") while
        // workshops.id is a UUID. Names + cities are written as a snapshot
        // by Create Case from the same source, so they always align.
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        const threeDaysAgoIso = threeDaysAgo.toISOString()
        const CLOSED = ['تم التسليم للعميل', 'تم البيع', 'خسارة كلية']

        const { data: jobCards } = await supabase
          .from('job_cards')
          .select('workshop_name, workshop_city, received_at, status')
          .lt('received_at', threeDaysAgoIso)
          .not('workshop_name', 'is', null)
          .not('status', 'in', `(${CLOSED.map(s => `"${s}"`).join(',')})`)

        // Calculate delayed cases per workshop, keyed by "name|city".
        const nameCityKey = (n: string | null, c: string | null) =>
          `${(n ?? '').trim()}|${(c ?? '').trim()}`
        const delayedMap = new Map<string, number>()
        if (jobCards) {
          for (const jc of jobCards as Array<{ workshop_name: string | null; workshop_city: string | null }>) {
            const k = nameCityKey(jc.workshop_name, jc.workshop_city)
            delayedMap.set(k, (delayedMap.get(k) ?? 0) + 1)
          }
        }

        // Merge workshops with counts, filter by valid coordinates
        const workshopsWithCounts: WorkshopWithCounts[] = (workshopsData || [])
          .filter(w => w.latitude !== null && w.longitude !== null)
          .map(w => ({
            id: w.id,
            workshop_name_ar: w.workshop_name_ar,
            city_ar: w.city_ar,
            latitude: w.latitude!,
            longitude: w.longitude!,
            total_cases: countsMap.get(w.id)?.total_cases ?? 0,
            open_cases: countsMap.get(w.id)?.open_cases ?? 0,
            closed_cases: countsMap.get(w.id)?.closed_cases ?? 0,
            delayed_cases: delayedMap.get(nameCityKey(w.workshop_name_ar, w.city_ar)) ?? 0,
          }))

        setWorkshops(workshopsWithCounts)
      } catch (err) {
        console.error('[WorkshopsMap] load failed', err)
        setError(isAr ? 'حدث خطأ أثناء التحميل' : 'An error occurred during loading')
      } finally {
        setLoading(false)
      }
    }

    loadWorkshops()
  }, [isAr])

  // Center on Saudi Arabia
  const center: [number, number] = [23.8859, 45.0792]
  const zoom = 5

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-48 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-64" />
        </div>
        <div className="h-[480px] flex items-center justify-center bg-gray-50 dark:bg-slate-800/50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAr ? 'جاري تحميل الخريطة...' : 'Loading map...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {isAr ? 'خريطة توزيع الورش' : 'Workshops Distribution Map'}
            </h3>
          </div>
        </div>
        <div className="h-[480px] flex items-center justify-center bg-gray-50 dark:bg-slate-800/50">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (workshops.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {isAr ? 'خريطة توزيع الورش' : 'Workshops Distribution Map'}
            </h3>
          </div>
        </div>
        <div className="h-[480px] flex items-center justify-center bg-gray-50 dark:bg-slate-800/50">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAr ? 'لا توجد بيانات مواقع للورش' : 'No workshop location data available'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <MapPin className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {isAr ? 'خريطة توزيع الورش' : 'Workshops Distribution Map'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isAr ? 'توزيع الورش داخل المملكة حسب عدد الحالات' : 'Distribution within the Kingdom by case count'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('markers')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'markers'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {isAr ? 'العلامات' : 'Markers'}
              </button>
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'heatmap'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {isAr ? 'خريطة الحرارة' : 'Heatmap'}
              </button>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {workshops.length} {isAr ? 'ورشة' : 'workshops'}
            </span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {isAr ? 'المؤشر:' : 'Legend:'}
          </span>
          {viewMode === 'markers' ? (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'ورشة' : 'Workshop'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-teal-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'حالات مفتوحة' : 'Open cases'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'حالات متأخرة' : 'Delayed cases'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'منخفض' : 'Low'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'متوسط' : 'Medium'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isAr ? 'عالي' : 'High'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ height: '480px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          {viewMode === 'markers' ? (
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              showCoverageOnHover={false}
              spiderfyOnMaxZoom={true}
              zoomToBoundsOnClick={true}
            >
              {workshops.map((workshop) => (
                <Marker
                  key={workshop.id}
                  position={[workshop.latitude, workshop.longitude]}
                  icon={getMarkerIcon(workshop.open_cases, workshop.delayed_cases)}
                >
                  <Popup>
                    <div className="text-sm" style={{ minWidth: '240px', direction: 'rtl' }}>
                      <div className="font-bold text-gray-900 dark:text-white text-base mb-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                        {workshop.workshop_name_ar}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {isAr ? 'المدينة' : 'City'}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white text-xs">
                            {workshop.city_ar || '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {isAr ? 'إجمالي الحالات' : 'Total Cases'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
                            {workshop.total_cases}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {isAr ? 'الحالات المفتوحة' : 'Open Cases'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                            {workshop.open_cases}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {isAr ? 'الحالات المتأخرة' : 'Delayed Cases'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            {workshop.delayed_cases}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          ) : (
            // Heatmap view using CircleMarker with gradient colors
            <>
              {workshops.map((workshop) => {
                const maxCases = Math.max(...workshops.map(w => w.total_cases), 1)
                const intensity = workshop.total_cases / maxCases
                const radius = 10 + (intensity * 30) // 10-40km radius
                const opacity = 0.3 + (intensity * 0.4) // 0.3-0.7 opacity
                
                // Color gradient: green -> yellow -> red
                let color = '#22c55e' // green
                if (intensity > 0.33) color = '#eab308' // yellow
                if (intensity > 0.66) color = '#ef4444' // red
                
                return (
                  <CircleMarker
                    key={workshop.id}
                    center={[workshop.latitude, workshop.longitude]}
                    radius={radius}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: opacity,
                      weight: 0,
                    }}
                  >
                    <Popup>
                      <div className="text-sm" style={{ minWidth: '240px', direction: 'rtl' }}>
                        <div className="font-bold text-gray-900 dark:text-white text-base mb-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                          {workshop.workshop_name_ar}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400 text-xs">
                              {isAr ? 'المدينة' : 'City'}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white text-xs">
                              {workshop.city_ar || '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400 text-xs">
                              {isAr ? 'إجمالي الحالات' : 'Total Cases'}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
                              {workshop.total_cases}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
