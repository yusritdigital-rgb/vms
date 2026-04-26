// =====================================================
// Replacement-vehicle handover checklist (PDF / print)
// -----------------------------------------------------
// Two-column inspection sheet printed when a case is created with a
// replacement vehicle. The right column (RTL) is the customer's main
// vehicle, the left column is the replacement vehicle assigned from
// the RV pool. Each side renders the usual identity block (plate,
// make/model, project, odometer) followed by a manual inspection
// checklist that the workshop officer fills in by hand at handover.
//
// Built on the same `openPrintWindow` engine used by invoice.ts and
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

// Inspection rows used on BOTH sides (handwritten ticks at print time).
const INSPECTION_ROWS_AR: string[] = [
  'الإطارات الأمامية',
  'الإطارات الخلفية',
  'الإطار الاحتياطي والأدوات',
  'المرايا الجانبية',
  'الأضواء الأمامية',
  'الأضواء الخلفية',
  'الزجاج الأمامي / الخلفي',
  'الصدامات (أمامي / خلفي)',
  'حالة الدهان والجسم',
  'البطارية ومستوى الشحن',
  'مستوى الزيت',
  'مستوى الوقود',
  'المكيف',
  'الراديو / الشاشة',
  'المساحات',
  'الأحزمة وداخلية المركبة',
]

function vehicleBlock(title: string, v: ChecklistVehicle): string {
  return `
    <div class="vh">
      <div class="vh-title">${esc(title)}</div>
      <div class="vh-kv">
        <div class="kv"><span class="k">رقم اللوحة</span><span class="v">${esc(v.plate_number) || '—'}</span></div>
        <div class="kv"><span class="k">الموديل</span><span class="v">${esc(v.make_model) || '—'}</span></div>
        <div class="kv"><span class="k">المشروع</span><span class="v">${esc(v.project_code) || '—'}</span></div>
        <div class="kv"><span class="k">العداد (كم)</span><span class="v">${
          v.odometer != null ? esc(v.odometer.toLocaleString('en-US')) : '—'
        }</span></div>
      </div>

      <table class="check">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>البند</th>
            <th class="state">سليم</th>
            <th class="state">تالف</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${INSPECTION_ROWS_AR.map((row, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>${esc(row)}</td>
              <td class="state"><span class="box"></span></td>
              <td class="state"><span class="box"></span></td>
              <td class="notes-cell"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="vh-notes">
        <span class="lbl">ملاحظات إضافية</span>
        <div class="lines">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `
}

export function generateReplacementChecklistPDF(args: ChecklistArgs): void {
  const lang = 'ar' as const
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const html = `
    <style>
      /* Checklist-specific styles, layered on top of PDF_STYLES. */
      .doc-header .doc-title { font-size: 18px; }
      .doc-header .doc-title .sub { letter-spacing: 1px; }

      .ck-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 8px;
      }
      .vh {
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 0;
        background: #fff;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .vh-title {
        background: var(--ink);
        color: #fff;
        font-weight: 800;
        font-size: 12px;
        padding: 7px 10px;
        letter-spacing: 0.3px;
      }
      .vh-kv {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 8px;
        padding: 8px 10px;
        background: var(--panel);
      }
      .vh-kv .kv {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        padding: 4px 6px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 10.5px;
      }
      .vh-kv .kv .k { color: var(--muted); font-weight: 600; }
      .vh-kv .kv .v { color: var(--ink); font-weight: 700; }

      table.check {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
      }
      table.check thead th {
        background: var(--panel-2);
        color: var(--ink);
        font-weight: 700;
        padding: 5px 6px;
        text-align: start;
        border-bottom: 1px solid var(--line);
      }
      table.check thead th.num   { width: 22px; text-align: center; }
      table.check thead th.state { width: 36px; text-align: center; }
      table.check tbody td {
        padding: 5px 6px;
        border-bottom: 1px solid var(--line);
      }
      table.check tbody td.num   { text-align: center; color: var(--muted); width: 22px; }
      table.check tbody td.state { text-align: center; }
      table.check tbody td.notes-cell { min-width: 70px; }
      table.check .box {
        display: inline-block;
        width: 12px; height: 12px;
        border: 1.2px solid var(--ink-2);
        border-radius: 2px;
        background: #fff;
      }

      .vh-notes {
        padding: 8px 10px 10px;
        border-top: 1px solid var(--line);
      }
      .vh-notes .lbl {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: var(--muted);
        margin-bottom: 4px;
        letter-spacing: 0.5px;
      }
      .vh-notes .lines span {
        display: block;
        height: 14px;
        border-bottom: 1px dashed var(--line-strong);
      }

      .ck-signatures {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 14px;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
      }
      .ck-signatures .sig { text-align: center; }
      .ck-signatures .sig .role {
        font-size: 10.5px; font-weight: 800; color: var(--ink-2);
        margin-bottom: 22px;
      }
      .ck-signatures .sig .line {
        border-top: 1px solid var(--line-strong);
        padding-top: 4px;
        font-size: 10px;
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
          نموذج تسليم مركبة بديلة
          <span class="sub">REPLACEMENT VEHICLE HANDOVER</span>
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

    <!-- Two-column inspection grid: right = main, left = replacement -->
    <div class="ck-grid">
      ${vehicleBlock('بيانات المركبة الأساسية', args.mainVehicle)}
      ${vehicleBlock('بيانات المركبة البديلة', args.replacementVehicle)}
    </div>

    <!-- Signature strip -->
    <div class="ck-signatures">
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
    ? `Replacement Checklist ${args.caseNumber}`
    : 'Replacement Checklist'
  openPrintWindow(html, lang, title)
}
