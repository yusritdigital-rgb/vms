// =====================================================
// Replacement-vehicle handover form (PDF / print)
// -----------------------------------------------------
// نموذج الاستلام والتسليم — single-page A4 form printed whenever
// a case has a replacement vehicle linked. Re-printable from the
// case detail page at any time (open OR closed cases).
//
// Layout (top → bottom, RTL):
//   1. Brand header + Arabic/English title
//   2. Compact meta strip (case #, date, workshop, officer)
//   3. Two slim vehicle-identity cards side-by-side (main / replacement)
//   4. Shared 6-row inspection checklist with two state columns
//      (الأساسية / البديلة) so a single sheet covers both vehicles
//   5. Top-down car outline area for handwritten damage marks
//   6. Three-up signature strip (workshop officer / customer / manager)
//   7. Company footer strip
//
// Built on the same `openPrintWindow` engine as invoice.ts and
// misuse.ts so the look is consistent with the existing print system.
// =====================================================

import {
  L,
  esc,
  fmtDate,
  openPrintWindow,
  companyFooterStrip,
  COMPANY_INFO,
} from '@/lib/pdf/shared'

export interface ChecklistVehicle {
  plate_number: string | null
  make_model: string | null
  project_code: string | null
  odometer: number | null
}

export interface ChecklistArgs {
  caseNumber: string | null
  caseDate: string | null            // ISO
  workshop: string | null            // display label
  assignedTo?: string | null         // user / handover-officer name
  mainVehicle: ChecklistVehicle
  replacementVehicle: ChecklistVehicle
}

export interface ReplacementReturnArgs {
  caseNumber: string | null
  caseDate: string | null            // ISO
  workshop: string | null            // display label
  returnDate: string | null           // ISO
  mainVehicle: {
    plate_number: string | null
    make_model: string | null
    project_code: string | null
  }
  replacementVehicle: {
    plate_number: string | null
    make_model: string | null
    outgoing_odometer: number | null
    return_odometer: number | null
    project_code: string | null
  }
  returnNotes?: string | null
}

// Only the essential items the workshop hands over with the vehicle.
// Each row is checked twice — once for the main vehicle (الأساسية) and
// once for the replacement (البديلة) — so the officer fills both
// sides on a single sheet.
const CHECKLIST_ITEMS_AR: string[] = [
  'عدة',
  'الإطار الاحتياطي',
  'طفاية حريق',
  'مسجل',
  'فرش أرضية',
  'ديكورات',
  'جهاز تحديد المواقع GPS',
  'اللوحة المرورية',
  'المساحات',
  'غطاء الإطار',
]

/** Compact vehicle identity card. */
function vehicleCard(title: string, v: ChecklistVehicle): string {
  return `
    <div class="vcard">
      <div class="vcard-title">${esc(title)}</div>
      <div class="vcard-grid">
        <div class="kv"><span class="k">رقم اللوحة</span><span class="v">${esc(v.plate_number) || '—'}</span></div>
        <div class="kv"><span class="k">نوع المركبة</span><span class="v">${esc(v.make_model) || '—'}</span></div>
        <div class="kv"><span class="k">المشروع</span><span class="v">${esc(v.project_code) || '—'}</span></div>
        <div class="kv"><span class="k">العداد (كم)</span><span class="v">${
          v.odometer != null ? esc(v.odometer.toLocaleString('en-US')) : '—'
        }</span></div>
      </div>
    </div>
  `
}

/**
 * Top-down 2D car outline for manual damage / scratch marking after
 * printing. Pure inline SVG so it prints on any browser without
 * external assets. Faint grey strokes so handwritten pen marks stand
 * out clearly.
 */
function carDiagramSVG(): string {
  return `
    <svg viewBox="0 0 520 200" preserveAspectRatio="xMidYMid meet" class="car-svg" xmlns="http://www.w3.org/2000/svg">
      <!-- Body outline -->
      <rect x="40" y="40" width="440" height="120" rx="48" ry="48"
            fill="none" stroke="#94a3b8" stroke-width="1.4"/>
      <!-- Hood line -->
      <line x1="120" y1="55" x2="120" y2="145" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Trunk line -->
      <line x1="400" y1="55" x2="400" y2="145" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Windshield + rear glass -->
      <path d="M 120 60 L 160 90 L 160 110 L 120 140"
            fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <path d="M 400 60 L 360 90 L 360 110 L 400 140"
            fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Roof / cabin sides -->
      <line x1="160" y1="90" x2="360" y2="90" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="160" y1="110" x2="360" y2="110" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Door split lines -->
      <line x1="225" y1="90" x2="225" y2="110" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="295" y1="90" x2="295" y2="110" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Side mirrors -->
      <rect x="150" y="32" width="14" height="6" rx="2" fill="none" stroke="#94a3b8" stroke-width="1"/>
      <rect x="150" y="162" width="14" height="6" rx="2" fill="none" stroke="#94a3b8" stroke-width="1"/>
      <!-- Wheels (top view: small rectangles flush with body) -->
      <rect x="100"  y="34"  width="22" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <rect x="380"  y="34"  width="22" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <rect x="100"  y="156" width="22" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <rect x="380"  y="156" width="22" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <!-- Direction labels (Arabic) -->
      <text x="60"  y="105" fill="#64748b" font-size="11" font-weight="700"
            text-anchor="middle">الأمام</text>
      <text x="460" y="105" fill="#64748b" font-size="11" font-weight="700"
            text-anchor="middle">الخلف</text>
      <text x="260" y="22"  fill="#94a3b8" font-size="10"
            text-anchor="middle">يمين</text>
      <text x="260" y="190" fill="#94a3b8" font-size="10"
            text-anchor="middle">يسار</text>
    </svg>
  `
}

export function generateReplacementChecklistPDF(args: ChecklistArgs): void {
  const lang = 'ar' as const
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const html = `
    <style>
      /* Tighten the global doc-header for this single-page form. */
      .doc-header .doc-title { font-size: 17px; }
      .doc-header .doc-title .sub { letter-spacing: 1px; font-size: 9.5px; }

      /* ── Vehicle identity cards ───────────────────── */
      .vcards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 6px;
      }
      .vcard {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .vcard-title {
        background: var(--ink);
        color: #fff;
        font-weight: 800;
        font-size: 11px;
        padding: 5px 9px;
        letter-spacing: 0.3px;
      }
      .vcard-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 6px;
        padding: 6px 8px;
        background: var(--panel);
      }
      .vcard-grid .kv {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        padding: 3px 6px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 10.5px;
      }
      .vcard-grid .kv .k { color: var(--muted); font-weight: 600; }
      .vcard-grid .kv .v { color: var(--ink); font-weight: 700; }

      /* ── Shared inspection table ──────────────────── */
      .section-h {
        margin-top: 10px;
        margin-bottom: 4px;
        padding: 4px 8px;
        background: var(--panel-2);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 800;
        color: var(--ink);
        letter-spacing: 0.3px;
      }
      table.inspect {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        page-break-inside: avoid;
      }
      table.inspect thead th {
        background: var(--panel);
        color: var(--ink);
        font-weight: 800;
        padding: 6px 8px;
        text-align: start;
        border: 1px solid var(--line);
      }
      table.inspect thead th.num   { width: 28px; text-align: center; }
      table.inspect thead th.col   { width: 100px; text-align: center; }
      table.inspect tbody td {
        padding: 6px 8px;
        border: 1px solid var(--line);
        background: #fff;
      }
      table.inspect tbody td.num   { text-align: center; color: var(--muted); }
      table.inspect tbody td.col {
        text-align: center;
      }
      .ck-cell {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        color: var(--muted);
      }
      .ck-cell .box {
        display: inline-block;
        width: 14px; height: 14px;
        border: 1.4px solid var(--ink-2);
        border-radius: 2px;
        background: #fff;
      }

      /* ── Diagram area for handwritten damage marks ── */
      .diagram-card {
        margin-top: 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px 6px;
        background: #fff;
        page-break-inside: avoid;
      }
      .diagram-card .diagram-title {
        font-size: 11px;
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 4px;
      }
      .diagram-card .diagram-hint {
        font-size: 9.5px;
        color: var(--muted);
        margin-bottom: 4px;
      }
      .car-svg {
        width: 100%;
        height: 150px;
        display: block;
      }

      /* ── Signatures ──────────────────────────────── */
      .sig-strip {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 14px;
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
        page-break-inside: avoid;
      }
      .sig-strip .sig { text-align: center; }
      .sig-strip .sig .role {
        font-size: 10.5px; font-weight: 800; color: var(--ink-2);
        margin-bottom: 26px;
      }
      .sig-strip .sig .line {
        border-top: 1px solid var(--line-strong);
        padding-top: 4px;
        font-size: 9.5px;
        color: var(--muted);
      }
    </style>

    <!-- Header -->
    <div class="doc-header">
      <div class="brand">
        <img src="${origin}/images/logo.png" alt="logo"
             onerror="this.style.display='none'" />
        <div>
          <div class="org-name">${esc(COMPANY_INFO.name_ar)}</div>
          <div class="org-sub">${esc(COMPANY_INFO.name_en)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">
          نموذج الاستلام والتسليم
          <span class="sub">VEHICLE HANDOVER &amp; RETURN FORM</span>
        </div>
      </div>
    </div>

    <!-- Meta strip -->
    <div class="doc-meta">
      <div class="cell">
        <span class="k">رقم الحالة</span>
        <span class="v">${esc(args.caseNumber) || '—'}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'dateLabel'))}</span>
        <span class="v">${esc(fmtDate(args.caseDate, lang))}</span>
      </div>
      <div class="cell">
        <span class="k">الورشة</span>
        <span class="v">${esc(args.workshop) || '—'}</span>
      </div>
      <div class="cell">
        <span class="k">المسؤول</span>
        <span class="v">${esc(args.assignedTo) || '—'}</span>
      </div>
    </div>

    <!-- Vehicle identity cards -->
    <div class="vcards">
      ${vehicleCard('بيانات المركبة الأساسية', args.mainVehicle)}
      ${vehicleCard('بيانات المركبة البديلة', args.replacementVehicle)}
    </div>

    <!-- Shared inspection checklist -->
    <div class="section-h">بنود الاستلام والتسليم</div>
    <table class="inspect">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>البند</th>
          <th class="col">المركبة الأساسية</th>
          <th class="col">المركبة البديلة</th>
        </tr>
      </thead>
      <tbody>
        ${CHECKLIST_ITEMS_AR.map((item, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(item)}</td>
            <td class="col">
              <span class="ck-cell"><span class="box"></span>سليم</span>
              &nbsp;&nbsp;
              <span class="ck-cell"><span class="box"></span>غير متوفر</span>
            </td>
            <td class="col">
              <span class="ck-cell"><span class="box"></span>سليم</span>
              &nbsp;&nbsp;
              <span class="ck-cell"><span class="box"></span>غير متوفر</span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- 2D car outline for manual marking -->
    <div class="diagram-card">
      <div class="diagram-title">مخطط المركبة — للملاحظة اليدوية</div>
      <div class="diagram-hint">يرجى تحديد مواضع الخدوش أو الأضرار يدوياً على المخطط بعد الطباعة.</div>
      ${carDiagramSVG()}
    </div>

    <!-- Signature strip -->
    <div class="sig-strip">
      <div class="sig">
        <div class="role">مسؤول الورشة</div>
        <div class="line">التوقيع</div>
      </div>
      <div class="sig">
        <div class="role">العميل / السائق</div>
        <div class="line">التوقيع</div>
      </div>
      <div class="sig">
        <div class="role">مدير الصيانة</div>
        <div class="line">التوقيع</div>
      </div>
    </div>

    <!-- Company footer strip -->
    ${companyFooterStrip(lang)}
  `

  const title = args.caseNumber
    ? `Handover Form ${args.caseNumber}`
    : 'Handover Form'
  openPrintWindow(html, lang, title)
}

/**
 * Generate a replacement vehicle return checklist PDF.
 * This is a simplified form focused on the return process, showing
 * the replacement vehicle details, odometer readings, and return information.
 */
export function generateReplacementReturnPDF(args: ReplacementReturnArgs): void {
  const lang = 'ar' as const
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const html = `
    <style>
      /* Tighten the global doc-header for this single-page form. */
      .doc-header .doc-title { font-size: 17px; }
      .doc-header .doc-title .sub { letter-spacing: 1px; font-size: 9.5px; }

      /* ── Vehicle identity card ───────────────────── */
      .vcard {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
        page-break-inside: avoid;
        margin-top: 8px;
      }
      .vcard-title {
        background: var(--ink);
        color: #fff;
        font-weight: 800;
        font-size: 11px;
        padding: 5px 9px;
        letter-spacing: 0.3px;
      }
      .vcard-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 6px;
        padding: 6px 8px;
        background: var(--panel);
      }
      .vcard-grid .kv {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        padding: 3px 6px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 10.5px;
      }
      .vcard-grid .kv .k { color: var(--muted); font-weight: 600; }
      .vcard-grid .kv .v { color: var(--ink); font-weight: 700; }

      /* ── Odometer comparison table ────────────────── */
      .section-h {
        margin-top: 10px;
        margin-bottom: 4px;
        padding: 4px 8px;
        background: var(--panel-2);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 800;
        color: var(--ink);
        letter-spacing: 0.3px;
      }
      table.odometer {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        page-break-inside: avoid;
      }
      table.odometer thead th {
        background: var(--panel);
        color: var(--ink);
        font-weight: 800;
        padding: 6px 8px;
        text-align: start;
        border: 1px solid var(--line);
      }
      table.odometer tbody td {
        padding: 6px 8px;
        border: 1px solid var(--line);
        background: #fff;
      }
      table.odometer tbody td.label { font-weight: 600; color: var(--muted); }
      table.odometer tbody td.value { font-weight: 700; color: var(--ink); }

      /* ── Notes section ───────────────────────────── */
      .notes-section {
        margin-top: 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px;
        background: #fff;
        page-break-inside: avoid;
      }
      .notes-section .notes-title {
        font-size: 11px;
        font-weight: 800;
        color: var(--ink);
        margin-bottom: 4px;
      }
      .notes-section .notes-content {
        font-size: 10.5px;
        color: var(--ink-2);
        min-height: 60px;
        border: 1px dashed var(--line);
        border-radius: 4px;
        padding: 6px;
        background: var(--panel);
      }

      /* ── Signatures ──────────────────────────────── */
      .sig-strip {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
        page-break-inside: avoid;
      }
      .sig-strip .sig { text-align: center; }
      .sig-strip .sig .role {
        font-size: 10.5px; font-weight: 800; color: var(--ink-2);
        margin-bottom: 26px;
      }
      .sig-strip .sig .line {
        border-top: 1px solid var(--line-strong);
        padding-top: 4px;
        font-size: 9.5px;
        color: var(--muted);
      }
    </style>

    <!-- Header -->
    <div class="doc-header">
      <div class="brand">
        <img src="${origin}/images/logo.png" alt="logo"
             onerror="this.style.display='none'" />
        <div>
          <div class="org-name">${esc(COMPANY_INFO.name_ar)}</div>
          <div class="org-sub">${esc(COMPANY_INFO.name_en)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">
          نموذج استلام المركبة البديلة
          <span class="sub">REPLACEMENT VEHICLE RETURN FORM</span>
        </div>
      </div>
    </div>

    <!-- Meta strip -->
    <div class="doc-meta">
      <div class="cell">
        <span class="k">رقم الحالة</span>
        <span class="v">${esc(args.caseNumber) || '—'}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'dateLabel'))}</span>
        <span class="v">${esc(fmtDate(args.caseDate, lang))}</span>
      </div>
      <div class="cell">
        <span class="k">الورشة</span>
        <span class="v">${esc(args.workshop) || '—'}</span>
      </div>
      <div class="cell">
        <span class="k">تاريخ العودة</span>
        <span class="v">${esc(fmtDate(args.returnDate, lang))}</span>
      </div>
    </div>

    <!-- Main vehicle reference -->
    <div class="section-h">مرجع المركبة الأساسية</div>
    <div class="vcard">
      <div class="vcard-grid">
        <div class="kv"><span class="k">رقم اللوحة</span><span class="v">${esc(args.mainVehicle.plate_number) || '—'}</span></div>
        <div class="kv"><span class="k">نوع المركبة</span><span class="v">${esc(args.mainVehicle.make_model) || '—'}</span></div>
        ${args.mainVehicle.project_code ? `<div class="kv"><span class="k">المشروع</span><span class="v">${esc(args.mainVehicle.project_code)}</span></div>` : ''}
      </div>
    </div>

    <!-- Replacement vehicle details -->
    <div class="section-h">بيانات المركبة البديلة</div>
    <div class="vcard">
      <div class="vcard-grid">
        <div class="kv"><span class="k">رقم اللوحة</span><span class="v">${esc(args.replacementVehicle.plate_number) || '—'}</span></div>
        <div class="kv"><span class="k">نوع المركبة</span><span class="v">${esc(args.replacementVehicle.make_model) || '—'}</span></div>
        ${args.replacementVehicle.project_code ? `<div class="kv"><span class="k">المشروع</span><span class="v">${esc(args.replacementVehicle.project_code)}</span></div>` : ''}
      </div>
    </div>

    <!-- Odometer comparison -->
    <div class="section-h">عداد المركبة البديلة</div>
    <table class="odometer">
      <thead>
        <tr>
          <th>البيان</th>
          <th>القيمة</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="label">عداد التسليم (الخروج)</td>
          <td class="value">${
            args.replacementVehicle.outgoing_odometer != null 
              ? esc(args.replacementVehicle.outgoing_odometer.toLocaleString('en-US')) + ' كم'
              : '—'
          }</td>
        </tr>
        <tr>
          <td class="label">عداد العودة (الاستلام)</td>
          <td class="value">${
            args.replacementVehicle.return_odometer != null 
              ? esc(args.replacementVehicle.return_odometer.toLocaleString('en-US')) + ' كم'
              : '—'
          }</td>
        </tr>
        <tr>
          <td class="label">فرق العداد</td>
          <td class="value">${
            args.replacementVehicle.outgoing_odometer != null && args.replacementVehicle.return_odometer != null
              ? esc((args.replacementVehicle.return_odometer - args.replacementVehicle.outgoing_odometer).toLocaleString('en-US')) + ' كم'
              : '—'
          }</td>
        </tr>
      </tbody>
    </table>

    <!-- Notes section -->
    <div class="notes-section">
      <div class="notes-title">ملاحظات العودة</div>
      <div class="notes-content">${esc(args.returnNotes) || ''}</div>
    </div>

    <!-- Signature strip -->
    <div class="sig-strip">
      <div class="sig">
        <div class="role">مسؤول الورشة</div>
        <div class="line">التوقيع</div>
      </div>
      <div class="sig">
        <div class="role">العميل / السائق</div>
        <div class="line">التوقيع</div>
      </div>
    </div>

    <!-- Company footer strip -->
    ${companyFooterStrip(lang)}
  `

  const title = args.caseNumber
    ? `Return Form ${args.caseNumber}`
    : 'Return Form'
  openPrintWindow(html, lang, title)
}

