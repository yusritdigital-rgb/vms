'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Car, ClipboardList, Receipt, Repeat, History, CalendarClock, LogIn, LayoutDashboard } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* Minimal Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <Image src="/images/logo.png" alt="VMS" fill className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 tracking-wide">VMS</span>
              <span className="text-[10px] text-gray-400 font-medium">نظام مراقبة المركبات</span>
            </div>
          </div>
          <Link
            href="/login?mode=admin"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            لوحة التحكم
          </Link>
        </div>
      </header>

      {/* Premium Hero with Geometric Elements */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        {/* Geometric red line elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-red-500/20 to-transparent" />
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-red-500/10 to-transparent" />
          <div className="absolute top-1/4 right-1/4 w-32 h-px bg-red-500/20" />
          <div className="absolute top-1/3 left-1/3 w-24 h-px bg-red-500/10" />
          <div className="absolute bottom-1/4 right-1/3 w-20 h-px bg-red-500/15" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            {/* Logo */}
            <div className="relative w-28 h-28 md:w-36 md:h-36 mx-auto mb-10">
              <Image
                src="/images/logo.png"
                alt="VMS"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
              نظام مراقبة المركبات
            </h1>

            {/* Subtitle */}
            <p className="text-sm md:text-base text-gray-400 tracking-[0.3em] font-semibold mb-8 uppercase">
              Vehicle Management System
            </p>

            {/* Description */}
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-12 max-w-2xl mx-auto font-light">
              منصة متكاملة لإدارة الأسطول، الحالات، المواعيد، الفوترة، والمركبات البديلة
            </p>

            {/* Single CTA */}
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-4 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <LogIn className="w-5 h-5" />
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">خدمات النظام</h2>
            <div className="w-16 h-1 bg-red-600 mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: ClipboardList, title: 'الحالات', desc: 'إدارة ومتابعة الحالات والتحديث اليومي' },
              { icon: Car, title: 'المركبات', desc: 'تسجيل ومتابعة جميع مركبات الأسطول' },
              { icon: CalendarClock, title: 'المواعيد', desc: 'جدولة مواعيد الصيانة ومتابعة الحضور' },
              { icon: Receipt, title: 'الفوترة', desc: 'إصدار وإدارة فواتير الصيانة والقطع' },
              { icon: Repeat, title: 'البدائل', desc: 'إدارة مركبات مشروع RV والمصروفة كبديلة' },
              { icon: History, title: 'سجل الحالات', desc: 'عرض الحالات المغلقة وتواريخ البدء والإغلاق' },
            ].map((service, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-2xl p-8 border border-gray-100 hover:border-red-200 hover:shadow-2xl transition-all duration-500"
              >
                {/* Geometric accent */}
                <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-red-500 to-red-600 rounded-r-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <service.icon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="VMS" fill className="object-contain" />
              </div>
              <span className="text-sm font-semibold text-gray-900">VMS</span>
            </div>
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} نظام مراقبة المركبات
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
