'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/Toast'
import { Loader2, FileText, Plus, Car, Calendar, Wrench, ArrowRight, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CaseRow {
  id: string
  job_card_number: string
  workshop_name: string | null
  workshop_city: string | null
  received_at: string | null
  status: string
  complaint_description: string | null
  type: 'mechanical' | 'accident' | null
  vehicle: {
    plate_number: string | null
    brand: string | null
    model: string | null
    project_code: string | null
  } | null
  invoice_id?: string | null
}

interface CaseDetail {
  case: CaseRow
  showDetails: boolean
  timeline?: Array<{
    id: string
    status: string
    note: string | null
    created_at: string
    user: {
      full_name: string | null
    } | null
  }>
}

export default function AwailInvoicesPage() {
  const { language, t } = useTranslation()
  const isAr = language === 'ar'
  const router = useRouter()
  const supabase = createClient()

  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null)
  const [showDetails, setShowDetails] = useState<CaseDetail | null>(null)
  const [creating, setCreating] = useState(false)

  // Load cases for Al-Awail workshop
  useEffect(() => {
    loadCases()
  }, [])

  const loadCases = async () => {
    setLoading(true)
    const { data: casesData, error: casesError } = await supabase
      .from('job_cards')
      .select(`
        id, job_card_number, workshop_name, workshop_city, received_at, status, complaint_description, type,
        vehicle:vehicles!job_cards_vehicle_id_fkey(plate_number, brand, model, project_code)
      `)
      .or('workshop_name.eq.الاوائل')
      .order('received_at', { ascending: false })

    if (casesError) {
      toast.error(isAr ? 'فشل تحميل الحالات' : 'Failed to load cases')
      console.error(casesError)
      setLoading(false)
      return
    }

    const cases = casesData as CaseRow[] || []
    
    // Check for existing invoices for each case
    const jobCardNumbers = cases.map(c => c.job_card_number)
    if (jobCardNumbers.length > 0) {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('job_card_number, id')
        .in('job_card_number', jobCardNumbers)
      
      const invoiceMap = new Map<string, string>()
      invoicesData?.forEach(inv => {
        if (inv.job_card_number) {
          invoiceMap.set(inv.job_card_number, inv.id)
        }
      })
      
      cases.forEach(c => {
        c.invoice_id = invoiceMap.get(c.job_card_number) || null
      })
    }

    setCases(cases)
    setLoading(false)
  }

  const handleViewDetails = async (c: CaseRow) => {
    // Load case timeline
    const { data: timelineData } = await supabase
      .from('case_updates')
      .select(`
        id, status, note, created_at,
        user:users!case_updates_user_id_fkey(full_name)
      `)
      .eq('case_id', c.id)
      .order('created_at', { ascending: true })

    setShowDetails({ 
      case: c, 
      showDetails: true,
      timeline: timelineData as CaseDetail['timeline']
    })
  }

  const handleCreateInvoice = async (c: CaseRow) => {
    setCreating(true)
    try {
      // Create invoice with draft status and only basic case info
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          invoice_date: new Date().toISOString().split('T')[0],
          vehicle_plate: c.vehicle?.plate_number || '',
          vehicle_label: [c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' '),
          workshop_name: [c.workshop_name, c.workshop_city].filter(Boolean).join(' — '),
          repair_type: c.status,
          status: 'draft',
          subtotal: 0,
          vat_percentage: 15,
          vat_amount: 0,
          total: 0,
          notes: c.complaint_description || null,
          job_card_number: c.job_card_number,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      toast.success(isAr ? 'تم إنشاء الفاتورة كمسودة' : 'Draft invoice created')
      
      // Redirect to invoices page to edit the invoice
      router.push(`/forms/invoices/${invoice.id}`)
    } catch (error: any) {
      toast.error(error?.message || (isAr ? 'فشل إنشاء الفاتورة' : 'Failed to create invoice'))
    }
    setCreating(false)
  }

  const closeDetails = () => {
    setShowDetails(null)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAr ? 'فواتير ورشة الأوائل' : 'Pioneer Workshop Invoices'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isAr ? 'إنشاء فواتير للحالات المستلمة بورشة الأوائل' : 'Create invoices for cases received at Pioneer workshop'}
        </p>
      </div>

      {/* Case Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isAr ? 'تفاصيل الحالة' : 'Case Details'}
              </h3>
              <button
                onClick={closeDetails}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'رقم الحالة' : 'Case Number'}</label>
                  <p className="font-mono font-semibold text-red-600">{showDetails.case.job_card_number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'الحالة' : 'Status'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">{isAr ? showDetails.case.status : (t(`jobCards.statuses.${showDetails.case.status}` as any) || showDetails.case.status)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'النوع' : 'Type'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {showDetails.case.type === 'mechanical' ? (isAr ? 'ميكانيكا' : 'Mechanical') : 
                     showDetails.case.type === 'accident' ? (isAr ? 'حادث' : 'Accident') : '—'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'اللوحة' : 'Plate'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">{showDetails.case.vehicle?.plate_number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'المركبة' : 'Vehicle'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">{[showDetails.case.vehicle?.brand, showDetails.case.vehicle?.model].filter(Boolean).join(' ')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'الورشة' : 'Workshop'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">{[showDetails.case.workshop_name, showDetails.case.workshop_city].filter(Boolean).join(' — ')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'تاريخ الاستلام' : 'Received Date'}</label>
                  <p className="font-medium text-gray-900 dark:text-white">{showDetails.case.received_at ? new Date(showDetails.case.received_at).toLocaleDateString('en-US') : '—'}</p>
                </div>
              </div>
              
              {showDetails.case.complaint_description && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'الشكوى' : 'Complaint'}</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{showDetails.case.complaint_description}</p>
                </div>
              )}

              {/* Timeline */}
              {showDetails.timeline && showDetails.timeline.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAr ? 'تسلسل الحالات' : 'Status Timeline'}</label>
                  <div className="mt-2 space-y-2">
                    {showDetails.timeline.map((update, index) => (
                      <div key={update.id} className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {update.status || '—'}
                            </p>
                            {update.note && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{update.note}</p>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                            <p>{update.user?.full_name || '—'}</p>
                            <p>{new Date(update.created_at).toLocaleDateString('en-US')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleCreateInvoice(showDetails.case)}
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {isAr ? 'إنشاء فاتورة والانتقال للفواتير' : 'Create Invoice & Go to Invoices'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isAr ? 'حالات ورشة الأوائل' : 'Pioneer Workshop Cases'}
          </h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {isAr ? 'لا توجد حالات لورشة الأوائل' : 'No cases found for Pioneer workshop'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {cases.map((c) => (
              <div key={c.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      <span className="font-mono font-semibold text-red-600">{c.job_card_number}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        {isAr ? c.status : (t(`jobCards.statuses.${c.status}` as any) || c.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        {c.vehicle?.plate_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="w-4 h-4" />
                        {[c.workshop_name, c.workshop_city].filter(Boolean).join(' — ')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {c.received_at ? new Date(c.received_at).toLocaleDateString('en-US') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetails(c)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      {isAr ? 'التفاصيل' : 'Details'}
                    </button>
                    {c.invoice_id ? (
                      <Link
                        href={`/forms/invoices/${c.invoice_id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {isAr ? 'عرض الفاتورة' : 'View Invoice'}
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleCreateInvoice(c)}
                        disabled={creating}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {isAr ? 'إنشاء فاتورة' : 'Create Invoice'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
