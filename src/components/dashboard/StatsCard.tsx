'use client'

interface StatsCardProps {
  title: string
  subtitle: string
  value: number
  color: 'green' | 'red' | 'yellow' | 'gray'
}

const colorClasses = {
  green: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
}

export default function StatsCard({ title, subtitle, value, color }: StatsCardProps) {
  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-80 mb-1">{title}</div>
      <div className="text-xs opacity-60 mb-3">{subtitle}</div>
      <div className="text-4xl font-bold">{value}</div>
    </div>
  )
}
