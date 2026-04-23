'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useSidebarStore } from '@/lib/stores/useSidebarStore'
import { useTrack } from '@/hooks/useTrack'
import type { Section } from '@/lib/tracks/accessMatrix'
import {
  LayoutGrid,
  Truck,
  ClockArrowDown,
  FolderKanban,
  FileCheck2,
  CalendarClock,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
} from 'lucide-react'

// Each nav item maps to an internal Section (used by track access matrix).
// URL paths (href) remain the original ones for backward compatibility.
const navItems: { key: string; section: Section; href: string; Icon: any }[] = [
  { key: 'dashboard',  section: 'dashboard',    href: '/dashboard',   Icon: LayoutGrid },
  { key: 'fleet',      section: 'vehicles',     href: '/fleet',       Icon: Truck },
  { key: 'history',    section: 'history',      href: '/history',     Icon: ClockArrowDown },
  { key: 'jobCards',   section: 'cases',        href: '/job-cards',   Icon: FolderKanban },
  { key: 'spareParts', section: 'alternatives', href: '/spare-parts', Icon: Repeat },
  { key: 'forms',      section: 'invoices',     href: '/forms',       Icon: FileCheck2 },
  { key: 'reserves',   section: 'appointments', href: '/reserves',    Icon: CalendarClock },
  { key: 'settings',   section: 'settings',     href: '/settings',    Icon: SlidersHorizontal },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t, language } = useTranslation()
  const { isOpen, toggle, close } = useSidebarStore()
  const { canView, loading: trackLoading } = useTrack()

  // Hide items for which the current track has no access ('none').
  // Track=null (no track) or admin => everything visible.
  const visibleItems = trackLoading ? [] : navItems.filter(item => canView(item.section))

  const handleNavClick = () => {
    close()
  }

  return (
    <>
      {/* Overlay for mobile / when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={close}
        />
      )}

      <aside
        className={`fixed top-0 start-0 h-full z-40 flex flex-col bg-white dark:bg-slate-900 border-e-2 border-red-600 dark:border-red-500 shadow-sm transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64' : 'w-[72px]'
        }`}
      >
        {/* Logo Area */}
        <div className={`flex items-center border-b border-gray-100 dark:border-slate-800 ${isOpen ? 'px-5 py-4 gap-3' : 'px-3 py-4 justify-center'}`}>
          <div className={`relative flex-shrink-0 ${isOpen ? 'w-11 h-11' : 'w-10 h-10'}`}>
            <Image
              src="/images/logo.png"
              alt="VMS"
              fill
              className="object-contain"
            />
          </div>
          {isOpen && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {t('system.shortName')}
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate">
                {language === 'ar' ? 'نظام مراقبة المركبات' : 'Vehicle Monitoring System'}
              </p>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <div className={`flex ${isOpen ? 'justify-end px-3' : 'justify-center'} py-2`}>
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? (
              language === 'ar' ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />
            ) : (
              language === 'ar' ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-1 space-y-1 overflow-y-auto overflow-x-hidden">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.Icon
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={handleNavClick}
                title={!isOpen ? t(`nav.${item.key}`) : undefined}
                className={`group relative flex items-center rounded-lg transition-all duration-200 ${
                  isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5'
                } ${
                  isActive
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-1 bottom-1 start-0 w-[3px] bg-red-600 dark:bg-red-400 rounded-full" />
                )}
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-red-600 dark:text-red-400' : ''}`} />
                {isOpen && (
                  <span className="text-sm flex-1 truncate">{t(`nav.${item.key}`)}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-800">
          {isOpen ? (
            <div className="flex items-center gap-2 px-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
              </span>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
