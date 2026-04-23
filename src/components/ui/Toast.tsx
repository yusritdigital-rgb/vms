'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration: number
}

interface ToastStore {
  toasts: ToastItem[]
  add: (type: ToastType, message: string, duration?: number) => void
  remove: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }))
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().add('success', message, duration),
  error: (message: string, duration?: number) => useToastStore.getState().add('error', message, duration),
  warning: (message: string, duration?: number) => useToastStore.getState().add('warning', message, duration),
  info: (message: string, duration?: number) => useToastStore.getState().add('info', message, duration),
}

export function useToast() {
  return { toast }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}

const CONFIGS: Record<ToastType, {
  Icon: React.ElementType
  border: string
  iconColor: string
  progress: string
}> = {
  success: { Icon: CheckCircle, border: 'border-red-400', iconColor: 'text-red-500', progress: 'bg-red-500' },
  error: { Icon: XCircle, border: 'border-red-400', iconColor: 'text-red-500', progress: 'bg-red-500' },
  warning: { Icon: AlertTriangle, border: 'border-yellow-400', iconColor: 'text-yellow-500', progress: 'bg-yellow-500' },
  info: { Icon: Info, border: 'border-blue-400', iconColor: 'text-blue-500', progress: 'bg-blue-500' },
}

function ToastCard({ item }: { item: ToastItem }) {
  const { remove } = useToastStore()
  const cfg = CONFIGS[item.type]
  const [show, setShow] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true))
    const t = setTimeout(() => {
      setShow(false)
      setTimeout(() => remove(item.id), 300)
    }, item.duration)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [item.id, item.duration])

  const close = () => {
    setShow(false)
    setTimeout(() => remove(item.id), 300)
  }

  return (
    <div
      role="alert"
      style={{ transition: 'opacity 0.3s, transform 0.3s' }}
      className={`
        relative flex items-start gap-3 w-80 max-w-[90vw]
        px-4 py-3 rounded-xl shadow-xl
        bg-white dark:bg-slate-900
        border border-gray-100 dark:border-slate-700
        border-s-4 ${cfg.border}
        ${show ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}
      `}
    >
      <cfg.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <p className="flex-1 text-sm font-medium text-gray-900 dark:text-white leading-snug">{item.message}</p>
      <button
        onClick={close}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded shrink-0 -me-1 -mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
      <div
        className={`absolute bottom-0 start-0 end-0 h-0.5 rounded-b-xl origin-start ${cfg.progress}`}
        style={{ animation: `toastShrink ${item.duration}ms linear forwards` }}
      />
      <style>{`@keyframes toastShrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 end-4 z-[9999] flex flex-col gap-3 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard item={t} />
        </div>
      ))}
    </div>
  )
}
