'use client'

// =====================================================
// /job-cards/[id] — Case detail
// -----------------------------------------------------
// Full case info + inline status/note update + timeline.
// Replacement vehicle & workshop shown as info blocks.
// No spare-parts UI, no works/damages UI — out of scope
// for the Cases module.
// =====================================================

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Car, Loader2, Wrench, Briefcase, StickyNote, ClipboardList, Gauge, Calendar, CheckCircle,
  UserCircle, Clock, Printer, Trash2, Edit2,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { getCase, updateExpectedCompletionDate } from '@/lib/cases/queries'
import type { CaseRow } from '@/lib/cases/types'
import { isClosedStatus } from '@/lib/cases/types'
import { STATUS_COLOR } from '@/lib/cases/statuses'
import { daysUntil, fmtDate, fmtDateTime } from '@/lib/cases/formatCase'
import { toast } from '@/components/ui/Toast'
import { AlertTriangle, Check, Pencil, X } from 'lucide-react'
import { createNotification } from '@/lib/notifications/queries'
import { WORKSHOPS, findWorkshopById } from '@/lib/workshops/workshops'

import CaseUpdateForm        from '@/components/cases/CaseUpdateForm'
import CaseTimeline          from '@/components/cases/CaseTimeline'
import AssignReplacementCard from '@/components/cases/AssignReplacementCard'
import { generateReplacementChecklistPDF, generateReplacementReturnPDF } from '@/lib/pdf/replacementChecklist'
import { generateReceivingHandoverPDF } from '@/lib/pdf/receivingHandover'

interface ReplacementVehicle {
  id: string
  plate_number: string | null
  brand: string | null
  model: string | null
  project_code: string | null
  /** Odometer of the replacement at handover time. Pulled from
   *  vehicle_odometer_readings (source='case_replacement_entry'); falls
   *  back to vehicles.current_odometer when the readings table is
   *  unavailable. */
  handover_odometer: number | null
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { language } = useTranslation()
  const isAr = language === 'ar'
  const { isAdmin } = usePermissions()

  const [c, setC] = useState<CaseRow | null>(null)
  const [alt, setAlt] = useState<ReplacementVehicle | null>(null)
  const [updaterName, setUpdaterName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [timelineKey, setTimelineKey] = useState(0)
  const [showWorkshopModal, setShowWorkshopModal] = useState(false)

  const reload = useCallback(async () => {
    const row = await getCase(params.id)
    setC(row)

    const supabase = createClient()

    // Debug logging
    console.log('[DEBUG] Case data:', {
      replacement_vehicle_id: row?.replacement_vehicle_id,
      replacement_vehicle: row?.replacement_vehicle,
      status: row?.status,
    })

    // Replacement vehicle snapshot — includes the project code and the
    // handover odometer reading so the print form can be re-issued at
    // any time without re-querying.
    // Always load if replacement_vehicle_id exists, even for closed cases,
    // to preserve historical data for PDF generation.
    // If replacement_vehicle_id is null (e.g., for cases closed before the fix),
    // try to restore from vehicle_odometer_readings history.
    let replacementVehicleId = row?.replacement_vehicle_id

    // If no replacement_vehicle_id, try to restore from history
    if (!replacementVehicleId && row?.id) {
      const { data: reading } = await supabase
        .from('vehicle_odometer_readings')
        .select('vehicle_id')
        .eq('case_id', row.id)
        .eq('source', 'case_replacement_entry')
        .limit(1)
        .maybeSingle()
      if (reading && (reading as any).vehicle_id) {
        replacementVehicleId = (reading as any).vehicle_id
        console.log('[DEBUG] Restored replacement_vehicle_id from history:', replacementVehicleId)
      }
    }

    if (replacementVehicleId) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('id, plate_number, brand, model, project_code, current_odometer')
        .eq('id', replacementVehicleId)
        .maybeSingle()

      console.log('[DEBUG] Vehicle data from query:', v)

      // Look up the original handover reading for THIS case so the
      // printed form reflects the value captured at assignment time,
      // not whatever the vehicle's odometer drifted to since.
      let handoverOdo: number | null = (v as any)?.current_odometer ?? null
      const { data: reading, error: readErr } = await supabase
        .from('vehicle_odometer_readings')
        .select('reading')
        .eq('case_id', row?.id)
        .eq('vehicle_id', replacementVehicleId)
        .eq('source', 'case_replacement_entry')
        .order('recorded_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!readErr && reading && typeof (reading as any).reading === 'number') {
        handoverOdo = (reading as any).reading as number
      }

      setAlt(v ? {
        id:                (v as any).id,
        plate_number:      (v as any).plate_number ?? null,
        brand:             (v as any).brand ?? null,
        model:             (v as any).model ?? null,
        project_code:      (v as any).project_code ?? null,
        handover_odometer: handoverOdo,
      } : null)
    } else {
      setAlt(null)
    }

    // Resolve the last updater's display name.
    // Priority: the denormalised `updated_by_name` on the most recent
    // case_updates row (always set for manual updates) → fallback to
    // user_preferences.full_name keyed on job_cards.last_updated_by.
    if (row?.id) {
      let name: string | null = null
      const { data: lastUpd } = await supabase
        .from('case_updates')
        .select('updated_by_name, created_at')
        .eq('case_id', row.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      name = (lastUpd as any)?.updated_by_name ?? null

      if (!name && row.last_updated_by) {
        const { data: pref } = await supabase
          .from('user_preferences')
          .select('full_name')
          .eq('user_id', row.last_updated_by)
          .maybeSingle()
        name = (pref as any)?.full_name ?? null
      }
      setUpdaterName(name)
    } else {
      setUpdaterName(null)
    }

    setLoading(false)
  }, [params.id])

  useEffect(() => { void reload() }, [reload])

  // Live-refresh when the row changes (any tab).
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`case-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_cards', filter: `id=eq.${params.id}` },
        () => { void reload() }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [params.id, reload])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }
  if (!c) {
    return (
      <div className="p-10 text-center text-sm text-gray-500" dir={isAr ? 'rtl' : 'ltr'}>
        {isAr ? 'الحالة غير موجودة' : 'Case not found'}
      </div>
    )
  }

  const badge = STATUS_COLOR[c.status as keyof typeof STATUS_COLOR]
    || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const closed = isClosedStatus(c.status)

  const handleDelete = async () => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذه الحالة؟ هذا الإجراء لا يمكن التراجع عنه.' : 'Are you sure you want to delete this case? This action cannot be undone.')) return
    const supabase = createClient()
    const { error } = await supabase.from('job_cards').delete().eq('id', c.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(isAr ? 'تم حذف الحالة' : 'Case deleted')
    router.push('/job-cards')
  }

  const handleWorkshopChange = async (newWorkshopId: string) => {
    const newWorkshop = findWorkshopById(newWorkshopId)
    if (!newWorkshop) return

    const supabase = createClient()
    const { error } = await supabase
      .from('job_cards')
      .update({
        workshop_name: newWorkshop.name_ar,
        workshop_city: newWorkshop.city_ar,
      })
      .eq('id', c.id)

    if (error) {
      toast.error(error.message)
      return
    }

    // Create notification for workshop transfer
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await createNotification({
        userId: user.id,
        type: 'workshop_transfer',
        title: isAr ? 'نقل ورشة' : 'Workshop Transfer',
        message: isAr 
          ? `تم نقل السيارة ${c.vehicle?.plate_number} من ${c.workshop_name} إلى ${newWorkshop.name_ar}`
          : `Vehicle ${c.vehicle?.plate_number} transferred from ${c.workshop_name} to ${newWorkshop.name_ar}`,
        caseId: c.id,
      })
    }

    toast.success(isAr ? 'تم تغيير الورشة' : 'Workshop changed')
    setShowWorkshopModal(false)
    reload()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <ClipboardList className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {c.job_card_number}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                {c.status}
              </span>
              {closed && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isAr ? 'مغلقة' : 'Closed'}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {isAr ? 'النوع:' : 'Type:'} {c.type === 'accident' ? (isAr ? 'حوادث' : 'Accident') : (isAr ? 'ميكانيكي' : 'Mechanical')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {isAr ? 'حذف' : 'Delete'}
            </button>
          )}
          <Link
            href="/job-cards"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            {isAr ? 'كل الحالات' : 'All cases'}
          </Link>
        </div>
      </div>

      {/* Last-updated-by banner — shown prominently under the header so
          it's immediately clear who last changed the case. */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 to-white dark:from-slate-900 dark:to-slate-900">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
            <UserCircle className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {isAr ? 'آخر تحديث بواسطة' : 'Last updated by'}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {updaterName || (isAr ? '— غير معروف —' : '— Unknown —')}
            </span>
          </div>
        </div>
        <span className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {isAr ? 'تاريخ آخر تحديث' : 'Last update time'}
            </span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">
              {fmtDateTime(c.last_updated_at) || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main vehicle */}
        <InfoBlock title={isAr ? 'المركبة الأساسية' : 'Main vehicle'} icon={<Car className="w-4 h-4" />}>
          <Row k={isAr ? 'اللوحة' : 'Plate'} v={c.vehicle?.plate_number ?? '—'} />
          <Row k={isAr ? 'المركبة' : 'Model'} v={[c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ') || '—'} />
          <Row k={isAr ? 'المشروع' : 'Project'} v={c.vehicle?.project_code ?? '—'} />
          {/* Receiving form button - always available */}
          <button
            type="button"
            onClick={() => {
              const handoverVehicles = [
                {
                  plateNumber: c.vehicle?.plate_number ?? null,
                  vehicleLabel: isAr ? 'المركبة الأساسية' : 'Main Vehicle',
                  movementType: 'دخول' as const,
                  odometer: c.entry_odometer,
                  vehicleMakeModel: [c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ') || null,
                },
                ...(alt || c.replacement_vehicle ? [{
                  plateNumber: alt?.plate_number ?? c.replacement_vehicle?.plate_number ?? null,
                  vehicleLabel: isAr ? 'المركبة البديلة' : 'Replacement Vehicle',
                  movementType: 'خروج' as const,
                  odometer: alt?.handover_odometer,
                  vehicleMakeModel: [alt?.brand ?? c.replacement_vehicle?.brand, alt?.model ?? c.replacement_vehicle?.model].filter(Boolean).join(' ') || null,
                }] : []),
              ]
              generateReceivingHandoverPDF({
                caseNumber: c.job_card_number,
                caseDate: c.received_at,
                workshop: [c.workshop_name, c.workshop_city].filter(Boolean).join(' — ') || null,
                vehicles: handoverVehicles,
              })
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            <Printer className="w-3.5 h-3.5" />
            {isAr ? 'نموذج الاستلام' : 'Receiving Form'}
          </button>
          {/* Handover form button - only available after exit odometer is recorded */}
          {c.exit_odometer != null && (
            <button
              type="button"
              onClick={() => {
                const handoverVehicles = [
                  {
                    plateNumber: c.vehicle?.plate_number ?? null,
                    vehicleLabel: isAr ? 'المركبة الأساسية' : 'Main Vehicle',
                    movementType: 'خروج' as const,
                    odometer: c.exit_odometer,
                    vehicleMakeModel: [c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ') || null,
                    projectCode: c.vehicle?.project_code ?? null,
                  },
                  ...(alt || c.replacement_vehicle ? [{
                    plateNumber: alt?.plate_number ?? c.replacement_vehicle?.plate_number ?? null,
                    vehicleLabel: isAr ? 'المركبة البديلة' : 'Replacement Vehicle',
                    movementType: 'دخول' as const,
                    odometer: c.replacement_return_odometer,
                    vehicleMakeModel: [alt?.brand ?? c.replacement_vehicle?.brand, alt?.model ?? c.replacement_vehicle?.model].filter(Boolean).join(' ') || null,
                    projectCode: alt?.project_code ?? c.replacement_vehicle?.project_code ?? null,
                  }] : []),
                ]
                generateReceivingHandoverPDF({
                  caseNumber: c.job_card_number,
                  caseDate: c.received_at,
                  workshop: [c.workshop_name, c.workshop_city].filter(Boolean).join(' — ') || null,
                  vehicles: handoverVehicles,
                })
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Printer className="w-3.5 h-3.5" />
              {isAr ? 'نموذج التسليم' : 'Handover Form'}
            </button>
          )}
        </InfoBlock>

        {/* Workshop */}
        <InfoBlock title={isAr ? 'الورشة' : 'Workshop'} icon={<Wrench className="w-4 h-4" />}>
          <Row k={isAr ? 'الاسم' : 'Name'} v={c.workshop_name ?? '—'} />
          <Row k={isAr ? 'المدينة' : 'City'} v={c.workshop_city ?? '—'} />
          {!closed && (
            <button
              onClick={() => setShowWorkshopModal(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {isAr ? 'تغيير الورشة' : 'Change Workshop'}
            </button>
          )}
        </InfoBlock>

        {/* Timing */}
        <InfoBlock title={isAr ? 'التواريخ' : 'Timing'} icon={<Calendar className="w-4 h-4" />}>
          <Row k={isAr ? 'تاريخ الاستلام' : 'Received'} v={fmtDateTime(c.received_at)} />
          <ExpectedDateRow
            caseRow={c}
            isAr={isAr}
            onSaved={reload}
          />
          <Row k={isAr ? 'تاريخ الإغلاق' : 'Completed'} v={fmtDateTime(c.completed_at)} />
          <Row k={isAr ? 'تاريخ التسليم' : 'Delivered'} v={fmtDateTime(c.delivered_at)} />
          <Row k={isAr ? 'آخر تحديث' : 'Last update'} v={fmtDateTime(c.last_updated_at)} />
        </InfoBlock>

        {/* Odometer */}
        <InfoBlock title={isAr ? 'العداد' : 'Odometer'} icon={<Gauge className="w-4 h-4" />}>
          <Row k={isAr ? 'دخول' : 'Entry'} v={`${(c.entry_odometer ?? 0).toLocaleString('en-US')} km`} />
          <Row k={isAr ? 'خروج' : 'Exit'}  v={c.exit_odometer != null ? `${c.exit_odometer.toLocaleString('en-US')} km` : '—'} />
        </InfoBlock>

        {/* Replacement vehicle */}
        <InfoBlock title={isAr ? 'المركبة البديلة' : 'Replacement vehicle'} icon={<Briefcase className="w-4 h-4" />}>
          {alt || c.replacement_vehicle ? (
            <>
              <Row k={isAr ? 'اللوحة' : 'Plate'} v={alt?.plate_number ?? c.replacement_vehicle?.plate_number ?? '—'} />
              <Row k={isAr ? 'المركبة' : 'Model'} v={[alt?.brand ?? c.replacement_vehicle?.brand, alt?.model ?? c.replacement_vehicle?.model].filter(Boolean).join(' ') || '—'} />
              {c.replacement_return_odometer && (
                <Row k={isAr ? 'عداد العودة' : 'Return Odometer'} v={`${c.replacement_return_odometer.toLocaleString('en-US')} km`} />
              )}
            </>
          ) : closed ? (
            // Closed cases stay read-only as historical data — no assign button.
            <p className="text-xs text-gray-500">{isAr ? 'لا توجد مركبة بديلة مرتبطة' : 'No replacement linked'}</p>
          ) : (
            <AssignReplacementCard
              caseId={c.id}
              mainVehicleId={c.vehicle_id}
              isAr={isAr}
              onAssigned={reload}
            />
          )}
        </InfoBlock>

        {/* Notes */}
        <InfoBlock title={isAr ? 'الملاحظات' : 'Notes'} icon={<StickyNote className="w-4 h-4" />}>
          <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">
            {c.complaint_description || (isAr ? '— لا شكوى —' : '— no complaint —')}
          </p>
          {c.internal_notes && (
            <p className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 whitespace-pre-line">
              <span className="font-semibold">{isAr ? 'داخلية: ' : 'Internal: '}</span>
              {c.internal_notes}
            </p>
          )}
        </InfoBlock>
      </div>

      {/* Update form */}
      {!closed && (
        <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            {isAr ? 'إضافة تحديث' : 'Add update'}
          </h2>
          <CaseUpdateForm
            caseId={c.id}
            currentStatus={c.status}
            isAr={isAr}
            onSaved={() => { void reload(); setTimelineKey(k => k + 1) }}
            caseData={{
              replacement_vehicle_id: c.replacement_vehicle_id,
              replacement_return_odometer: c.replacement_return_odometer,
            }}
            vehicleData={{
              mainVehicle: {
                plate_number: c.vehicle?.plate_number || null,
                make_model: [c.vehicle?.brand, c.vehicle?.model].filter(Boolean).join(' ') || null,
                exit_odometer: c.exit_odometer || null,
                project_code: c.vehicle?.project_code || null,
              },
              replacementVehicle: c.replacement_vehicle ? {
                plate_number: c.replacement_vehicle.plate_number || null,
                make_model: [c.replacement_vehicle.brand, c.replacement_vehicle.model].filter(Boolean).join(' ') || null,
                return_odometer: c.replacement_return_odometer || null,
                project_code: c.replacement_vehicle.project_code || null,
              } : undefined,
            }}
            caseNumber={c.job_card_number}
            workshopName={c.workshop_name}
            receivedAt={c.received_at}
          />
        </section>
      )}

      {/* Timeline */}
      <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
          {isAr ? 'سجل التحديثات' : 'Update timeline'}
        </h2>
        <CaseTimeline caseId={c.id} key={timelineKey} language={isAr ? 'ar' : 'en'} />
      </section>

      {/* Workshop Change Modal */}
      {showWorkshopModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isAr ? 'تغيير الورشة' : 'Change Workshop'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isAr ? 'اختر الورشة الجديدة' : 'Select new workshop'}
              </p>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-2">
                {WORKSHOPS.map((workshop) => (
                  <button
                    key={workshop.id}
                    onClick={() => handleWorkshopChange(workshop.id)}
                    className="w-full text-start px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{workshop.name_ar}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{workshop.city_ar}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowWorkshopModal(false)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
        <span className="text-red-600">{icon}</span>{title}
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-gray-500 min-w-[90px]">{k}</span>
      <span className="text-gray-800 dark:text-gray-200 font-mono break-all">{v}</span>
    </div>
  )
}

/**
 * Inline-editable row for `expected_completion_date`. Sits inside the
 * Timing block on the case detail page. The status of the case is NOT
 * touched — the workshop can extend the deadline freely without forcing
 * a closure or any other workflow change.
 *
 * For closed cases the row renders read-only: the planned date is shown
 * as historical context but the pencil/edit affordance is hidden.
 */
function ExpectedDateRow({
  caseRow, isAr, onSaved,
}: {
  caseRow: CaseRow
  isAr: boolean
  onSaved: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(caseRow.expected_completion_date ?? '')
  const [saving, setSaving] = useState(false)

  const isClosed = isClosedStatus(caseRow.status)
  const remain = isClosed ? null : daysUntil(caseRow.expected_completion_date)
  const overdue = remain !== null && remain < 0
  const nearDue = remain !== null && remain >= 0 && remain <= 1
  const minDate = caseRow.received_at ? caseRow.received_at.slice(0, 10) : undefined
  const label = isAr ? 'متوقع الانتهاء' : 'Expected'

  const submit = async () => {
    if (saving) return
    setSaving(true)
    const res = await updateExpectedCompletionDate(caseRow.id, value || null)
    setSaving(false)
    if (!res.ok) {
      toast.error(isAr ? 'تعذر تحديث التاريخ' : 'Failed to update date')
      return
    }
    toast.success(isAr ? 'تم تحديث التاريخ المتوقع' : 'Expected date updated')
    setEditing(false)
    void onSaved()
  }

  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-gray-500 min-w-[90px]">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="date"
            value={value}
            min={minDate}
            onChange={(e) => setValue(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setValue(caseRow.expected_completion_date ?? '') }}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap text-gray-800 dark:text-gray-200">
          <span className="font-mono">
            {caseRow.expected_completion_date ? fmtDate(caseRow.expected_completion_date) : '—'}
          </span>
          {overdue && remain !== null && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              {isAr ? `متأخرة ${Math.abs(remain)} يوم` : `Overdue ${Math.abs(remain)}d`}
            </span>
          )}
          {nearDue && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500 text-white text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              {isAr ? 'قرب انتهاء الوقت المتوقع' : 'Near due'}
            </span>
          )}
          {!overdue && !nearDue && remain !== null && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
              {isAr ? `باقي: ${remain} ${remain === 1 ? 'يوم' : 'أيام'}` : `${remain}d left`}
            </span>
          )}
          {!isClosed && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title={isAr ? 'تعديل التاريخ المتوقع' : 'Edit expected date'}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 text-[11px]"
            >
              <Pencil className="w-3 h-3" />
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

