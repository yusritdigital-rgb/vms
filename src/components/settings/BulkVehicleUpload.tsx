'use client'

// =====================================================
// Vehicle Import — reads the new 6-column comma CSV:
//   المشروع, رقم اللوحة عربي, رقم اللوحة انجليزي,
//   الشركة المصنعة, الموديل, رقم الشاصي
// -----------------------------------------------------
// Duplicate detection is keyed on chassis_number (primary)
// with plate_number as a fallback.
// Vehicles are inserted with a default company_id to keep
// back-compat with existing company-filtered queries.
// =====================================================

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  Loader2, RefreshCw, Info, Eye, Car,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───
interface VehicleRow {
  srcLine: number
  projectCode: string
  plateNumber: string      // English plate → vehicles.plate_number
  plateNumberAr: string    // Arabic plate  → vehicles.plate_number_ar
  manufacturer: string
  model: string
  chassisNumber: string
  status: 'valid' | 'skip_empty' | 'dup_db_chassis' | 'dup_db_plate' | 'dup_file'
}

interface ImportResult {
  total: number
  skipped: number
  validCount: number
  dupCount: number
  inserted: number
  updated: number
  failed: number
  errors: { line: number; ref: string; msg: string }[]
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

// ─── File reading with encoding fallback ───
async function readFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  let text = new TextDecoder('utf-8').decode(buf)
  if (!/[\u0600-\u06FF]/.test(text)) {
    try { text = new TextDecoder('windows-1256').decode(buf) } catch {}
  }
  return text.replace(/^\uFEFF/, '')
}

// ─── Minimal CSV parser that honours quoted fields (comma-delimited) ───
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cur.push(field); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur); cur = []; field = '' }
        if (ch === '\r' && text[i + 1] === '\n') i++
      } else field += ch
    }
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows
}

// Header → column-index map. Tolerant of minor spelling variants.
function buildColumnIndex(headerRow: string[]): Record<string, number> {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const idx: Record<string, number> = {}
  headerRow.forEach((h, i) => { idx[norm(h)] = i })
  const pick = (...cands: string[]) => {
    for (const c of cands) if (c in idx) return idx[c]
    return -1
  }
  return {
    project:   pick('المشروع', 'project', 'Project'),
    plateAr:   pick('رقم اللوحة عربي', 'رقم اللوحة (ع)', 'رقم اللوحة العربي'),
    plateEn:   pick('رقم اللوحة انجليزي', 'رقم اللوحة (ا)', 'رقم اللوحة الانجليزي', 'plate'),
    brand:     pick('الشركة المصنعة', 'الصانع', 'manufacturer', 'brand'),
    model:     pick('الموديل', 'الطراز', 'model'),
    chassis:   pick('رقم الشاصي', 'رقم الهيكل', 'chassis', 'vin'),
  }
}

function mapRow(cells: string[], lineNum: number, colMap: Record<string, number>): VehicleRow {
  const get = (k: string) => {
    const i = colMap[k]
    return i >= 0 ? (cells[i] ?? '').trim().replace(/\s+/g, ' ') : ''
  }
  const plateNumber   = get('plateEn')
  const plateNumberAr = get('plateAr')
  const chassisNumber = get('chassis')
  const projectCode   = get('project')
  const manufacturer  = get('brand')
  const model         = get('model')

  let status: VehicleRow['status'] = 'valid'
  if (!chassisNumber && !plateNumber) status = 'skip_empty'

  return { srcLine: lineNum, projectCode, plateNumber, plateNumberAr, manufacturer, model, chassisNumber, status }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VehicleImportSystem() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<VehicleRow[]>([])
  const [dupAction, setDupAction] = useState<'skip' | 'update'>('skip')
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [result, setResult] = useState<ImportResult | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)

  // Cached default company_id (keeps back-compat: inserted vehicles still show
  // up in company-filtered queries used elsewhere in the app).
  const [defaultCompanyId, setDefaultCompanyId] = useState<string | null>(null)

  useEffect(() => { loadDefaults(); loadLogs() }, [])

  const loadDefaults = async () => {
    // Prefer an active company; fall back to any company if none is active.
    const { data: active } = await supabase
      .from('companies').select('id').eq('is_active', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (active?.id) { setDefaultCompanyId(active.id); return }
    const { data: any1 } = await supabase
      .from('companies').select('id')
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    setDefaultCompanyId(any1?.id ?? null)
  }

  const loadLogs = async () => {
    try {
      const { data } = await supabase.from('import_logs').select('*').order('imported_at', { ascending: false }).limit(10)
      if (data) setLogs(data)
    } catch {}
  }

  // ─── Analyze ───
  const analyze = async () => {
    if (!file) return
    setAnalyzing(true)
    try {
      const text = await readFile(file)
      const raw = parseCSV(text).filter(r => r.some(c => c.trim() !== ''))
      if (raw.length < 2) { alert('الملف فارغ أو لا يحتوي على صف الرؤوس'); setAnalyzing(false); return }
      const colMap = buildColumnIndex(raw[0])
      if (colMap.chassis < 0 && colMap.plateEn < 0) {
        alert('لم يتم العثور على أعمدة "رقم الشاصي" أو "رقم اللوحة انجليزي" في الملف')
        setAnalyzing(false); return
      }

      const mapped = raw.slice(1).map((cells, i) => mapRow(cells, i + 2, colMap))

      // Duplicate detection against DB (chassis first, plate fallback)
      const chassisList = Array.from(new Set(mapped.filter(r => r.status === 'valid' && r.chassisNumber).map(r => r.chassisNumber)))
      const plateList   = Array.from(new Set(mapped.filter(r => r.status === 'valid' && r.plateNumber).map(r => r.plateNumber)))

      const dbChassis = new Set<string>()
      const dbPlates  = new Set<string>()
      if (chassisList.length) {
        // Chunk to avoid oversized "in()" filters
        for (let i = 0; i < chassisList.length; i += 400) {
          const chunk = chassisList.slice(i, i + 400)
          const { data } = await supabase.from('vehicles').select('chassis_number').in('chassis_number', chunk)
          for (const r of (data as any[]) ?? []) if (r.chassis_number) dbChassis.add(r.chassis_number)
        }
      }
      if (plateList.length) {
        for (let i = 0; i < plateList.length; i += 400) {
          const chunk = plateList.slice(i, i + 400)
          const { data } = await supabase.from('vehicles').select('plate_number').in('plate_number', chunk)
          for (const r of (data as any[]) ?? []) if (r.plate_number) dbPlates.add(r.plate_number)
        }
      }

      // In-file duplicate tracking
      const seenChassis = new Set<string>()
      const seenPlates  = new Set<string>()
      const final = mapped.map<VehicleRow>(r => {
        if (r.status !== 'valid') return r
        // DB dup
        if (r.chassisNumber && dbChassis.has(r.chassisNumber)) return { ...r, status: 'dup_db_chassis' }
        if (!r.chassisNumber && r.plateNumber && dbPlates.has(r.plateNumber)) return { ...r, status: 'dup_db_plate' }
        // In-file dup
        const key = r.chassisNumber || r.plateNumber
        if (key) {
          const seen = r.chassisNumber ? seenChassis : seenPlates
          if (seen.has(key)) return { ...r, status: 'dup_file' }
          seen.add(key)
        }
        return r
      })

      setRows(final)
      setStep('preview')
    } catch (e: any) {
      alert('خطأ في تحليل الملف: ' + (e?.message ?? e))
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── Import ───
  const runImport = async () => {
    const toInsert = rows.filter(r => r.status === 'valid')
    const toUpdate = dupAction === 'update'
      ? rows.filter(r => r.status === 'dup_db_chassis' || r.status === 'dup_db_plate')
      : []

    setStep('importing')
    setImporting(true)
    setProgress(0)

    const { data: { user } } = await supabase.auth.getUser()
    let inserted = 0, updated = 0, failed = 0
    const errors: ImportResult['errors'] = []

    // ─ Insert (batches of 50) ─
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50).map((r) => ({
        plate_number:     r.plateNumber || null,
        plate_number_ar:  r.plateNumberAr || null,
        chassis_number:   r.chassisNumber || `IMP-${r.plateNumber.replace(/\s/g, '-')}-${Date.now()}-${i}`,
        brand:            r.manufacturer,
        manufacturer:     r.manufacturer,
        model:            r.model,
        project_code:     r.projectCode || null,
        is_mobile_maintenance: false,
        current_odometer: 0,
        company_id:       defaultCompanyId,  // back-compat default
      }))

      const { error } = await supabase.from('vehicles').insert(batch)
      if (!error) {
        inserted += batch.length
      } else {
        // Fall back to per-row insert so one bad row doesn't kill the batch.
        for (let k = 0; k < batch.length; k++) {
          const { error: e2 } = await supabase.from('vehicles').insert(batch[k])
          if (e2) {
            failed++
            const ref = toInsert[i + k].chassisNumber || toInsert[i + k].plateNumber
            errors.push({ line: toInsert[i + k].srcLine, ref, msg: e2.message })
          } else inserted++
        }
      }
      setProgress((i + batch.length) / Math.max(toInsert.length + toUpdate.length, 1))
    }

    // ─ Update duplicates (only if user chose "update") ─
    for (let i = 0; i < toUpdate.length; i++) {
      const r = toUpdate[i]
      const patch = {
        plate_number_ar: r.plateNumberAr || null,
        brand:           r.manufacturer,
        manufacturer:    r.manufacturer,
        model:           r.model,
        project_code:    r.projectCode || null,
      }
      const q = r.chassisNumber
        ? supabase.from('vehicles').update(patch).eq('chassis_number', r.chassisNumber)
        : supabase.from('vehicles').update(patch).eq('plate_number', r.plateNumber)
      const { error } = await q
      if (error) { failed++; errors.push({ line: r.srcLine, ref: r.chassisNumber || r.plateNumber, msg: error.message }) }
      else updated++
      setProgress((toInsert.length + i + 1) / Math.max(toInsert.length + toUpdate.length, 1))
    }

    const total = rows.length
    const skipped = rows.filter(r => r.status === 'skip_empty').length
    const validCount = toInsert.length
    const dupCount = rows.filter(r => r.status === 'dup_db_chassis' || r.status === 'dup_db_plate' || r.status === 'dup_file').length
    const res: ImportResult = { total, skipped, validCount, dupCount, inserted, updated, failed, errors }
    setResult(res)

    try {
      await supabase.from('import_logs').insert({
        imported_by: user?.id,
        file_name: file?.name,
        total_rows: total,
        success_count: inserted + updated,
        failed_count: failed,
        duplicate_count: dupCount,
        errors,
      })
    } catch {}

    setImporting(false)
    setStep('done')
    loadLogs()
  }

  const reset = () => {
    setStep('upload'); setFile(null); setRows([]); setResult(null); setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Counters for the preview
  const vCount      = rows.filter(r => r.status === 'valid').length
  const dupDBCount  = rows.filter(r => r.status === 'dup_db_chassis' || r.status === 'dup_db_plate').length
  const dupFCount   = rows.filter(r => r.status === 'dup_file').length
  const skipCount   = rows.filter(r => r.status === 'skip_empty').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">استيراد المركبات</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            يقبل ملف CSV بـ 6 أعمدة: المشروع · رقم اللوحة عربي · رقم اللوحة انجليزي · الشركة المصنعة · الموديل · رقم الشاصي
          </p>
        </div>
        <button onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800">
          <FileText className="w-3.5 h-3.5" /> السجل
        </button>
      </div>

      {showLogs && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold mb-2 text-gray-800 dark:text-white">آخر عمليات الاستيراد</p>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400">لا يوجد سجل</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="text-xs flex justify-between py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <span className="text-gray-600 dark:text-gray-400 truncate">{l.file_name ?? '—'}</span>
                  <span className="text-gray-500">{l.success_count}/{l.total_rows}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ UPLOAD ═══════════════════════════════════════════════════════════════ */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* File Drop */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white mb-3">
              <Upload className="w-4 h-4 text-red-600" /> ملف CSV *
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${file ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-slate-600 hover:border-red-400'}`}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
              {file ? (
                <div className="space-y-1">
                  <CheckCircle className="w-10 h-10 text-red-500 mx-auto" />
                  <p className="font-medium text-red-700 dark:text-red-300">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-xs text-red-500 hover:underline">إزالة</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">اسحب ملف CSV أو انقر للاختيار</p>
                  <p className="text-xs text-gray-400">ترميز UTF-8 مفضّل (Windows-1256 مدعوم أيضاً)</p>
                </div>
              )}
            </div>
          </div>

          {/* Dup action */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">سلوك المركبات المكررة</p>
            <div className="grid grid-cols-2 gap-3">
              {([['skip', 'تجاهل', 'المركبة موجودة → تخطى'], ['update', 'تحديث', 'المركبة موجودة → تُحدَّث']] as [string, string, string][]).map(([v, l, d]) => (
                <button key={v} onClick={() => setDupAction(v as any)}
                  className={`p-3 rounded-xl border-2 text-start transition-all
                    ${dupAction === v ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-slate-700'}`}>
                  <p className={`font-medium text-sm ${dupAction === v ? 'text-red-700' : 'text-gray-700 dark:text-gray-300'}`}>{l}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-semibold">بنية الملف المتوقعة:</p>
              <code className="block bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-1 text-[10px] leading-5" dir="rtl">
                المشروع , رقم اللوحة عربي , رقم اللوحة انجليزي , الشركة المصنعة , الموديل , رقم الشاصي
              </code>
              <p>يتم تحديد التكرار حسب <strong>رقم الشاصي</strong> ثم <strong>رقم اللوحة الانجليزي</strong>.</p>
            </div>
          </div>

          <button onClick={analyze} disabled={!file || analyzing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold">
            {analyzing
              ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري التحليل...</>
              : <><Eye className="w-5 h-5" /> تحليل الملف</>}
          </button>
        </div>
      )}

      {/* ══ PREVIEW ═══════════════════════════════════════════════════════════════ */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="الإجمالي"           value={rows.length} />
            <Stat label="صالح للاستيراد"     value={vCount}     tone="emerald" />
            <Stat label="مكرر في قاعدة البيانات" value={dupDBCount} tone="amber" />
            <Stat label="مكرر داخل الملف"     value={dupFCount} tone="amber" />
            <Stat label="تم التخطي"           value={skipCount} tone="slate" />
          </div>

          {/* Mapped preview */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">
                معاينة أول {Math.min(100, rows.length)} صف
              </p>
              <p className="text-xs text-gray-400">يتم عرض تعيين الأعمدة كما سيتم حفظه في قاعدة البيانات</p>
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                  <tr className="text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2 text-start">السطر</th>
                    <th className="px-3 py-2 text-start">الحالة</th>
                    <th className="px-3 py-2 text-start">المشروع</th>
                    <th className="px-3 py-2 text-start">اللوحة (ع)</th>
                    <th className="px-3 py-2 text-start">اللوحة (ا)</th>
                    <th className="px-3 py-2 text-start">الصانع</th>
                    <th className="px-3 py-2 text-start">الموديل</th>
                    <th className="px-3 py-2 text-start">الشاصي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-slate-800">
                      <td className="px-3 py-1.5 text-gray-400 font-mono">{r.srcLine}</td>
                      <td className="px-3 py-1.5"><StatusPill s={r.status} /></td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.projectCode}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300" dir="rtl">{r.plateNumberAr}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono" dir="ltr">{r.plateNumber}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.manufacturer}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.model}</td>
                      <td className="px-3 py-1.5 text-gray-500 font-mono" dir="ltr">{r.chassisNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
              رجوع
            </button>
            <button onClick={runImport} disabled={vCount === 0 && dupDBCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold">
              <Car className="w-4 h-4" /> استيراد {vCount}{dupAction === 'update' && dupDBCount > 0 ? ` + تحديث ${dupDBCount}` : ''}
            </button>
          </div>
        </div>
      )}

      {/* ══ IMPORTING ═════════════════════════════════════════════════════════════ */}
      {step === 'importing' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
          <p className="font-semibold text-gray-800 dark:text-white">جاري الاستيراد...</p>
          <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-200"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">{(progress * 100).toFixed(0)}%</p>
        </div>
      )}

      {/* ══ DONE ══════════════════════════════════════════════════════════════════ */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-200">اكتمل الاستيراد</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                تمت إضافة {result.inserted} مركبة{result.updated > 0 && ` · تحديث ${result.updated}`}{result.failed > 0 && ` · فشل ${result.failed}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="تم الإدخال" value={result.inserted} tone="emerald" />
            <Stat label="تم التحديث" value={result.updated}  tone="blue" />
            <Stat label="مكرر"        value={result.dupCount} tone="amber" />
            <Stat label="متخطى"       value={result.skipped}  tone="slate" />
            <Stat label="فشل"         value={result.failed}   tone={result.failed > 0 ? 'red' : 'slate'} />
          </div>

          {result.errors.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">الأخطاء ({result.errors.length})</p>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 text-start">السطر</th>
                      <th className="px-3 py-2 text-start">المعرّف</th>
                      <th className="px-3 py-2 text-start">الرسالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-1.5 font-mono text-gray-400">{e.line}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{e.ref}</td>
                        <td className="px-3 py-1.5 text-red-600">{e.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold">
              <RefreshCw className="w-4 h-4" /> استيراد ملف جديد
            </button>
            <a href="/fleet"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold">
              <Car className="w-4 h-4" /> فتح قائمة المركبات
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small presentational helpers ───
function Stat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate'|'emerald'|'amber'|'blue'|'red' }) {
  const cls: Record<string, string> = {
    slate:   'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    blue:    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    red:     'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  }
  return (
    <div className={`rounded-xl p-3 ${cls[tone]}`}>
      <p className="text-[11px] opacity-75">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  )
}

function StatusPill({ s }: { s: VehicleRow['status'] }) {
  const map: Record<VehicleRow['status'], { text: string; cls: string; Icon: any }> = {
    valid:           { text: 'صالح',        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', Icon: CheckCircle },
    skip_empty:      { text: 'متخطى',       cls: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400',             Icon: XCircle },
    dup_db_chassis:  { text: 'مكرر (شاصي)', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       Icon: AlertTriangle },
    dup_db_plate:    { text: 'مكرر (لوحة)', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       Icon: AlertTriangle },
    dup_file:        { text: 'مكرر بالملف', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       Icon: AlertTriangle },
  }
  const m = map[s]
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${m.cls}`}><m.Icon className="w-3 h-3" />{m.text}</span>
}
