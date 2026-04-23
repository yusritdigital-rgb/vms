'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { Flame } from 'lucide-react'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export default function WeeklyActivityHeatmap() {
  const { language } = useTranslation()
  const [series, setSeries] = useState<{ name: string; data: { x: string; y: number }[] }[]>([])

  const daysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const supabase = createClient()
    // Single-tenant workshop model: no company_id filter.
    const { data: cases } = await supabase.from('job_cards').select('created_at')

    const now = new Date()
    const days = language === 'ar' ? daysAr : daysEn
    const weeksCount = 8

    // Build grid: rows = days of week, cols = weeks
    const weekLabels: string[] = []
    for (let w = weeksCount - 1; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7)
      weekLabels.push(
        // Force en-US so weekly-axis labels always render with Western digits.
        weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      )
    }

    const grid: number[][] = Array.from({ length: 7 }, () => Array(weeksCount).fill(0))

    if (cases) {
      cases.forEach((jc: any) => {
        const d = new Date(jc.created_at)
        const dayOfWeek = d.getDay()
        // Which week bucket
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        const weekIdx = weeksCount - 1 - Math.floor(diffDays / 7)
        if (weekIdx >= 0 && weekIdx < weeksCount) {
          grid[dayOfWeek][weekIdx]++
        }
      })
    }

    // ApexCharts heatmap: each series = a row (day of week), data = columns (weeks)
    const seriesData = days.map((dayName, dayIdx) => ({
      name: dayName,
      data: weekLabels.map((weekLabel, weekIdx) => ({
        x: weekLabel,
        y: grid[dayIdx][weekIdx],
      })),
    })).reverse()

    setSeries(seriesData)
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'heatmap',
      fontFamily: 'Cairo, sans-serif',
      toolbar: { show: false },
    },
    plotOptions: {
      heatmap: {
        shadeIntensity: 0.5,
        radius: 4,
        colorScale: {
          ranges: [
            { from: 0, to: 0, name: language === 'ar' ? 'لا نشاط' : 'None', color: '#e2e8f0' },
            { from: 1, to: 1, name: language === 'ar' ? 'قليل' : 'Low', color: '#bae6fd' },
            { from: 2, to: 3, name: language === 'ar' ? 'متوسط' : 'Medium', color: '#38bdf8' },
            { from: 4, to: 6, name: language === 'ar' ? 'عالي' : 'High', color: '#0284c7' },
            { from: 7, to: 100, name: language === 'ar' ? 'مرتفع جداً' : 'Very High', color: '#0c4a6e' },
          ],
        },
      },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: '10px', fontWeight: '500', colors: ['#1e293b'] },
    },
    xaxis: {
      labels: { style: { fontSize: '9px', colors: '#94a3b8' }, rotate: -45 },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: '#64748b' } },
    },
    grid: { padding: { top: -10, bottom: 0 } },
    legend: {
      position: 'bottom',
      fontSize: '10px',
      labels: { colors: '#64748b' },
      markers: { size: 8, shape: 'square' as any },
    },
    tooltip: {
      y: { formatter: (val: number) => `${val} ${language === 'ar' ? 'حالة' : 'cases'}` },
    },
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-5 h-5 text-sky-500" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {language === 'ar' ? 'نشاط الحالات الأسبوعي' : 'Weekly Cases Activity'}
        </h3>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        {language === 'ar' ? 'توزيع الحالات حسب أيام الأسبوع خلال آخر 8 أسابيع' : 'Cases distribution by day of week over last 8 weeks'}
      </p>
      <Chart options={options} series={series} type="heatmap" height={280} />
    </div>
  )
}
