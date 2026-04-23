'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export default function MonthlyTrendChart() {
  const { language } = useTranslation()
  const [labels, setLabels] = useState<string[]>([])
  const [accidentData, setAccidentData] = useState<number[]>([])
  const [mechanicalData, setMechanicalData] = useState<number[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: cases } = await supabase
      .from('job_cards')
      .select('type, created_at')
    if (!cases) return

    const now = new Date()
    const cats: string[] = []
    const accident: number[] = []
    const mechanical: number[] = []

    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      // Force en-US so month-axis labels always render with Western digits.
      cats.push(month.toLocaleDateString('en-US', { month: 'short' }))

      const monthCases = cases.filter((jc: any) => {
        const d = new Date(jc.created_at)
        return d >= month && d <= monthEnd
      })
      const monthJobs = monthCases

      accident.push(monthJobs.filter((jc: any) => jc.type === 'accident').length)
      mechanical.push(monthJobs.filter((jc: any) => jc.type === 'mechanical').length)
    }

    setLabels(cats)
    setAccidentData(accident)
    setMechanicalData(mechanical)
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      fontFamily: 'Cairo, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ['#a855f7', '#ec4899'],
    stroke: { curve: 'smooth', width: 3 },
    markers: {
      size: 5,
      colors: ['#fff'],
      strokeColors: ['#a855f7', '#ec4899'],
      strokeWidth: 2.5,
      hover: { sizeOffset: 2 },
    },
    xaxis: {
      categories: labels,
      labels: { style: { fontSize: '11px', colors: '#94a3b8', fontWeight: '500' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: '#cbd5e1' } },
      forceNiceScale: true,
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { top: -10, bottom: 0 },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
      labels: { colors: '#64748b' },
      markers: { size: 8, shape: 'circle' as any },
    },
    tooltip: { theme: 'dark' },
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-purple-500" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {language === 'ar' ? 'اتجاه الحالات الشهري' : 'Monthly Cases Trend'}
        </h3>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        {language === 'ar' ? 'مقارنة الحوادث والميكانيكي شهرياً' : 'Accident vs Mechanical monthly comparison'}
      </p>
      <Chart
        options={options}
        series={[
          { name: language === 'ar' ? 'حوادث' : 'Accident', data: accidentData },
          { name: language === 'ar' ? 'ميكانيكي' : 'Mechanical', data: mechanicalData },
        ]}
        type="line"
        height={280}
      />
    </div>
  )
}
