'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Car, Wrench, ClipboardList, Receipt, Repeat, History, CalendarClock, LogIn, LayoutDashboard } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="VMS" width={36} height={36} />
            <span className="text-sm font-bold text-gray-800 tracking-wide">VMS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-semibold transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              تسجيل الدخول
            </Link>
            <Link
              href="/login?mode=admin"
              className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-200 rounded text-xs font-semibold transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              لوحة التحكم
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — White background, large logo */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-20 flex flex-col items-center text-center">
          <div className="relative w-44 h-44 md:w-56 md:h-56 mb-8">
            <Image
              src="/images/logo.png"
              alt="VMS"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-snug">
            نظام مراقبة المركبات
          </h1>
          <p className="text-sm text-gray-400 tracking-widest font-medium mb-3">
            VEHICLE MANAGEMENT SYSTEM
          </p>
          <div className="w-12 h-[2px] bg-red-600 rounded-full mb-5" />
          <p className="text-sm text-gray-500 mb-0">
            لوحة التحكم ومتابعة الأسطول
          </p>
        </div>
      </section>

      {/* Separator */}
      <div className="border-t border-gray-200" />

      {/* Features */}
      <section className="bg-gray-50 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">خدمات النظام</h2>
          <p className="text-xs text-gray-400 text-center mb-10">الوظائف الأساسية المتاحة عبر المنصة</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: ClipboardList, title: 'الحالات',        desc: 'إنشاء ومتابعة الحالات والتحديث اليومي' },
              { icon: CalendarClock, title: 'المواعيد',       desc: 'جدولة مواعيد الصيانة ومتابعة الحضور' },
              { icon: Receipt,       title: 'الفوترة',        desc: 'إصدار وإدارة فواتير الصيانة والقطع' },
              { icon: Repeat,        title: 'البدائل',        desc: 'إدارة مركبات مشروع RV والمصروفة كبديلة' },
              { icon: Car,           title: 'قائمة المركبات', desc: 'تسجيل ومتابعة جميع مركبات الأسطول' },
              { icon: History,       title: 'سجل الحالات',    desc: 'عرض الحالات المغلقة وتواريخ البدء والإغلاق' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-red-200 transition-colors">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center mb-3">
                  <item.icon className="w-4.5 h-4.5 text-red-700" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="VMS" width={20} height={20} />
            <span className="text-[11px] font-bold text-gray-600">VMS</span>
            <span className="text-[10px] text-gray-300 mx-1">|</span>
            <span className="text-[10px] text-gray-400">نظام مراقبة المركبات</span>
          </div>
          <p className="text-[10px] text-gray-300">جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  )
}
