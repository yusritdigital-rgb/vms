'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'

interface CarZone {
  id: string
  label_ar: string
  label_en: string
  path: string
}

const carZones: CarZone[] = [
  // Front
  { id: 'front_bumper', label_ar: 'الصدام الأمامي', label_en: 'Front Bumper', path: 'M 120,28 L 280,28 Q 290,28 290,38 L 290,58 Q 290,68 280,68 L 120,68 Q 110,68 110,58 L 110,38 Q 110,28 120,28 Z' },
  { id: 'hood', label_ar: 'غطاء المحرك', label_en: 'Hood', path: 'M 125,72 L 275,72 L 270,130 L 130,130 Z' },
  { id: 'front_windshield', label_ar: 'الزجاج الأمامي', label_en: 'Front Windshield', path: 'M 132,134 L 268,134 L 260,175 L 140,175 Z' },
  // Roof
  { id: 'roof', label_ar: 'السقف', label_en: 'Roof', path: 'M 142,179 L 258,179 L 258,270 L 142,270 Z' },
  // Rear windshield
  { id: 'rear_windshield', label_ar: 'الزجاج الخلفي', label_en: 'Rear Windshield', path: 'M 140,274 L 260,274 L 268,315 L 132,315 Z' },
  // Trunk
  { id: 'trunk', label_ar: 'صندوق الخلف', label_en: 'Trunk', path: 'M 130,319 L 270,319 L 275,377 L 125,377 Z' },
  // Rear bumper
  { id: 'rear_bumper', label_ar: 'الصدام الخلفي', label_en: 'Rear Bumper', path: 'M 120,381 L 280,381 Q 290,381 290,391 L 290,411 Q 290,421 280,421 L 120,421 Q 110,421 110,411 L 110,391 Q 110,381 120,381 Z' },
  // Left side (driver)
  { id: 'left_front_fender', label_ar: 'الرفرف الأمامي الأيسر', label_en: 'Left Front Fender', path: 'M 60,72 L 108,72 L 108,130 L 60,120 Z' },
  { id: 'left_front_door', label_ar: 'الباب الأمامي الأيسر', label_en: 'Left Front Door', path: 'M 55,124 L 108,134 L 108,225 L 55,225 Z' },
  { id: 'left_rear_door', label_ar: 'الباب الخلفي الأيسر', label_en: 'Left Rear Door', path: 'M 55,229 L 108,229 L 108,315 L 55,325 Z' },
  { id: 'left_rear_fender', label_ar: 'الرفرف الخلفي الأيسر', label_en: 'Left Rear Fender', path: 'M 60,329 L 108,319 L 108,377 L 60,377 Z' },
  // Right side (passenger)
  { id: 'right_front_fender', label_ar: 'الرفرف الأمامي الأيمن', label_en: 'Right Front Fender', path: 'M 292,72 L 340,72 L 340,120 L 292,130 Z' },
  { id: 'right_front_door', label_ar: 'الباب الأمامي الأيمن', label_en: 'Right Front Door', path: 'M 292,134 L 345,124 L 345,225 L 292,225 Z' },
  { id: 'right_rear_door', label_ar: 'الباب الخلفي الأيمن', label_en: 'Right Rear Door', path: 'M 292,229 L 345,229 L 345,325 L 292,315 Z' },
  { id: 'right_rear_fender', label_ar: 'الرفرف الخلفي الأيمن', label_en: 'Right Rear Fender', path: 'M 292,319 L 340,329 L 340,377 L 292,377 Z' },
  // Lights
  { id: 'left_headlight', label_ar: 'المصباح الأمامي الأيسر', label_en: 'Left Headlight', path: 'M 110,30 L 120,28 L 120,65 L 110,58 Z' },
  { id: 'right_headlight', label_ar: 'المصباح الأمامي الأيمن', label_en: 'Right Headlight', path: 'M 280,28 L 290,30 L 290,58 L 280,65 Z' },
  { id: 'left_taillight', label_ar: 'المصباح الخلفي الأيسر', label_en: 'Left Taillight', path: 'M 110,391 L 120,381 L 120,421 L 110,411 Z' },
  { id: 'right_taillight', label_ar: 'المصباح الخلفي الأيمن', label_en: 'Right Taillight', path: 'M 280,381 L 290,391 L 290,411 L 280,421 Z' },
  // Wheels
  { id: 'left_front_wheel', label_ar: 'العجلة الأمامية اليسرى', label_en: 'Left Front Wheel', path: 'M 40,95 A 20,20 0 1,1 40,135 A 20,20 0 1,1 40,95 Z' },
  { id: 'left_rear_wheel', label_ar: 'العجلة الخلفية اليسرى', label_en: 'Left Rear Wheel', path: 'M 40,310 A 20,20 0 1,1 40,350 A 20,20 0 1,1 40,310 Z' },
  { id: 'right_front_wheel', label_ar: 'العجلة الأمامية اليمنى', label_en: 'Right Front Wheel', path: 'M 360,95 A 20,20 0 1,1 360,135 A 20,20 0 1,1 360,95 Z' },
  { id: 'right_rear_wheel', label_ar: 'العجلة الخلفية اليمنى', label_en: 'Right Rear Wheel', path: 'M 360,310 A 20,20 0 1,1 360,350 A 20,20 0 1,1 360,310 Z' },
  // Mirrors
  { id: 'left_mirror', label_ar: 'المرآة اليسرى', label_en: 'Left Mirror', path: 'M 40,155 L 54,148 L 54,168 L 40,175 Z' },
  { id: 'right_mirror', label_ar: 'المرآة اليمنى', label_en: 'Right Mirror', path: 'M 346,148 L 360,155 L 360,175 L 346,168 Z' },
]

interface CarDamageDiagramProps {
  language: string
  selectedZones: string[]
  onToggleZone: (zoneId: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function CarDamageDiagram({ language, selectedZones, onToggleZone, onConfirm, onCancel }: CarDamageDiagramProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  const getZoneFill = (zoneId: string) => {
    if (selectedZones.includes(zoneId)) return 'rgba(239, 68, 68, 0.5)'
    if (hoveredZone === zoneId) return 'rgba(59, 130, 246, 0.25)'
    return 'rgba(34, 197, 94, 0.08)'
  }

  const getZoneStroke = (zoneId: string) => {
    if (selectedZones.includes(zoneId)) return '#ef4444'
    if (hoveredZone === zoneId) return '#3b82f6'
    return '#94a3b8'
  }

  const hoveredInfo = carZones.find(z => z.id === hoveredZone)

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Car SVG */}
        <div className="flex-1 bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {language === 'ar' ? 'اضغط على المنطقة المتضررة' : 'Click on the damaged area'}
            </p>
            {hoveredInfo && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                {language === 'ar' ? hoveredInfo.label_ar : hoveredInfo.label_en}
              </span>
            )}
          </div>
          <svg viewBox="0 0 400 450" className="w-full max-w-[320px] mx-auto" style={{ height: 'auto' }}>
            {/* Car body outline */}
            <rect x="100" y="25" width="200" height="400" rx="15" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4" />

            {/* Direction arrow - FRONT */}
            <text x="200" y="18" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
              {language === 'ar' ? '▲ أمام' : '▲ FRONT'}
            </text>
            <text x="200" y="440" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
              {language === 'ar' ? '▼ خلف' : '▼ REAR'}
            </text>
            <text x="15" y="225" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="600" transform="rotate(-90, 15, 225)">
              {language === 'ar' ? 'يسار' : 'LEFT'}
            </text>
            <text x="385" y="225" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="600" transform="rotate(90, 385, 225)">
              {language === 'ar' ? 'يمين' : 'RIGHT'}
            </text>

            {/* Clickable zones */}
            {carZones.map((zone) => (
              <path
                key={zone.id}
                d={zone.path}
                fill={getZoneFill(zone.id)}
                stroke={getZoneStroke(zone.id)}
                strokeWidth={selectedZones.includes(zone.id) ? 2 : 1}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => onToggleZone(zone.id)}
              />
            ))}

          </svg>
        </div>

        {/* Selected zones list */}
        <div className="lg:w-56 space-y-2">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            {language === 'ar' ? `الأضرار المحددة (${selectedZones.length})` : `Selected Damages (${selectedZones.length})`}
          </p>
          {selectedZones.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              {language === 'ar' ? 'لم يتم تحديد أضرار' : 'No damages selected'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {selectedZones.map(zoneId => {
                const zone = carZones.find(z => z.id === zoneId)
                if (!zone) return null
                return (
                  <div key={zoneId} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">
                      {language === 'ar' ? zone.label_ar : zone.label_en}
                    </span>
                    <button onClick={() => onToggleZone(zoneId)} className="text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
        >
          {language === 'ar' ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          onClick={onConfirm}
          disabled={selectedZones.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {language === 'ar' ? `إضافة ${selectedZones.length} ضرر` : `Add ${selectedZones.length} Damage(s)`}
        </button>
      </div>
    </div>
  )
}

export { carZones }
export type { CarZone }
