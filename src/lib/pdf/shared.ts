// =====================================================
// Shared infrastructure for invoice-style PDFs
// (Invoice + Misuse + any future "official" document).
// -----------------------------------------------------
// Goals:
//   - Formal, corporate look suitable for real-world printing and approval.
//   - RED used ONLY as a subtle brand accent — no gradients on content, no
//     aggressive fills behind user data.
//   - Full Arabic / English duality (labels, title, direction).
//   - Shared footer block: IBAN + bank details + service-manager
//     signature (with sig.png) + logo watermark.
// =====================================================

export type PdfLang = 'ar' | 'en'

export const isPdfLangRtl = (lang: PdfLang) => lang === 'ar'

// ─── Label dictionaries ──────────────────────────────
export const PDF_LABELS = {
  // Generic
  dateLabel:            { ar: 'التاريخ',               en: 'Date' },
  referenceLabel:       { ar: 'مرجع الدفع',            en: 'Payment Reference' },
  notes:                { ar: 'ملاحظات',                en: 'Notes' },
  none:                 { ar: '— لا يوجد —',           en: '— None —' },
  signature:            { ar: 'التوقيع',                en: 'Signature' },

  // Invoice
  invoiceTitle:         { ar: 'فاتورة داخلية',          en: 'Internal Invoice' },
  invoiceNumber:        { ar: 'رقم الفاتورة',           en: 'Invoice No.' },
  status:               { ar: 'الحالة',                 en: 'Status' },
  repairType:           { ar: 'نوع الإصلاح',            en: 'Repair Type' },
  vehicleAndBeneficiary:{ ar: 'بيانات المركبة والجهة',   en: 'Vehicle & Beneficiary' },
  plate:                { ar: 'رقم اللوحة',             en: 'Plate No.' },
  vehicle:              { ar: 'المركبة',                en: 'Vehicle' },
  project:              { ar: 'المشروع',                en: 'Project' },
  workshop:             { ar: 'الورشة',                 en: 'Workshop' },
  issuedTo:             { ar: 'مقدم إلى',               en: 'Issued To' },
  maintenanceManager:   { ar: 'مدير الصيانة',           en: 'Maintenance Manager' },
  technician:           { ar: 'الفني المسؤول',          en: 'Technician' },
  workHours:            { ar: 'عدد ساعات العمل',        en: 'Work Hours' },
  invoiceItems:         { ar: 'بنود الفاتورة',          en: 'Invoice Items' },
  colType:              { ar: 'النوع',                  en: 'Type' },
  colDescription:       { ar: 'الوصف',                  en: 'Description' },
  colQuantity:          { ar: 'الكمية',                 en: 'Qty' },
  colUnitPrice:         { ar: 'سعر الوحدة',             en: 'Unit Price' },
  colLineTotal:         { ar: 'الإجمالي',               en: 'Line Total' },
  noItems:              { ar: 'لا توجد بنود',           en: 'No items' },
  subtotal:             { ar: 'المجموع قبل الضريبة',    en: 'Subtotal' },
  vat:                  { ar: 'ضريبة القيمة المضافة',   en: 'VAT' },
  grandTotal:           { ar: 'الإجمالي النهائي',       en: 'Grand Total' },
  workshopOfficer:      { ar: 'مسؤول الورشة',           en: 'Workshop Officer' },
  recipient:            { ar: 'المستلم',                en: 'Recipient' },
  beneficiaryParty:     { ar: 'الجهة المستفيدة',        en: 'Beneficiary' },
  currencySar:          { ar: 'ر.س',                    en: 'SAR' },

  // Misuse
  misuseTitle:          { ar: 'نموذج سوء الاستخدام / تحميل تكلفة الإصلاح', en: 'Misuse / Repair-Cost Charge Form' },
  misuseNumber:         { ar: 'رقم السجل',              en: 'Registration No.' },
  vehicleType:          { ar: 'نوع السيارة',            en: 'Vehicle Type' },
  basicInfo:            { ar: 'المعلومات الأساسية',     en: 'Basic Information' },
  labor:                { ar: 'الأعمال',                en: 'Labor' },
  spareParts:           { ar: 'قطع الغيار',             en: 'Spare Parts' },
  laborTotalCost:       { ar: 'إجمالي تكلفة الأعمال',   en: 'Total Labor Cost' },
  partsTotalCost:       { ar: 'إجمالي تكلفة قطع الغيار', en: 'Total Parts Cost' },
  colPart:              { ar: 'اسم القطعة',             en: 'Part Name' },
  discount:             { ar: 'الخصم',                  en: 'Discount' },

  // Signature block
  authorizedOfficer:    { ar: 'المسؤول المعتمد',        en: 'Authorised Officer' },

  // Company footer strip
  unifiedNumber:        { ar: 'الرقم الموحد',           en: 'Unified No.' },
  chamberMembership:    { ar: 'عضوية الغرفة التجارية',  en: 'Chamber Membership' },
  phoneShort:           { ar: 'هاتف',                   en: 'Tel' },
  faxShort:             { ar: 'فاكس',                   en: 'Fax' },
  extensionShort:       { ar: 'تحويلة',                 en: 'Ext' },
  postalCodeShort:      { ar: 'الرمز البريدي',          en: 'P.O.' },
} as const satisfies Record<string, { ar: string; en: string }>

// ─── Company constants (shown in the bottom footer strip) ──
export const COMPANY_INFO = {
  name_ar:            'شركة الأوائل للتأجير',
  name_en:            'Al-Awael Leasing Company',
  unifiedNumber:      '7008229895',
  chamberMembership:  '590841',
  phone:              '00966112330099',
  fax:                '00966112377852',
  extension:          '400',
  address_ar:         'الرياض – حي المنار',
  address_en:         'Riyadh – Al-Manar District',
  postalCode:         '14221',
  websiteUrl:         'https://www.pioneerlease.com',
  websiteLabel:       'www.pioneerlease.com',
} as const

export type PdfLabelKey = keyof typeof PDF_LABELS

export function L(lang: PdfLang, key: PdfLabelKey): string {
  return PDF_LABELS[key][lang]
}

// ─── Formal stylesheet (reduced red, corporate palette) ─────
// Red remains the brand accent only — on the top border, footer line,
// subtle section rules, and the signature accent. Everything else uses
// slate/navy for a professional document look.
export const PDF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 14mm; }

  :root {
    --accent:       #B91C1C;   /* red — accent only */
    --accent-soft:  #FEE2E2;
    --ink:          #0b1220;
    --ink-2:        #1f2937;
    --muted:        #64748b;
    --line:         #e5e7eb;
    --line-strong:  #cbd5e1;
    --panel:        #f8fafc;
    --panel-2:      #f1f5f9;
  }

  body {
    font-family: 'Cairo', 'Inter', 'Segoe UI', Tahoma, Arial, sans-serif;
    font-size: 11.5px;
    color: var(--ink);
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #fff;
  }

  /* A4 content area minus @page margins. Using flex-column lets us push
     the .company-strip to the very bottom of single-page documents. */
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 0;
    min-height: calc(297mm - 28mm);
    display: flex;
    flex-direction: column;
  }
  .page > .company-strip { margin-top: auto; }

  /* ─── Document header ─── */
  .doc-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .doc-header .brand {
    display: flex; align-items: center; gap: 12px;
  }
  .doc-header .brand img { height: 46px; width: auto; object-fit: contain; }
  .doc-header .brand .org-name {
    font-size: 15px; font-weight: 800; color: var(--ink);
  }
  .doc-header .brand .org-sub {
    font-size: 10.5px; color: var(--muted); margin-top: 1px;
  }
  .doc-header .doc-title-box {
    text-align: end;
  }
  .doc-header .doc-title {
    font-size: 17px; font-weight: 800; color: var(--ink);
    letter-spacing: 0.2px;
  }
  .doc-header .doc-title .sub {
    display: block; font-size: 10px; font-weight: 600;
    color: var(--muted); letter-spacing: 1px;
    text-transform: uppercase; margin-top: 2px;
  }

  /* ─── Meta strip (number / date / status) ─── */
  .doc-meta {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
  }
  .doc-meta .cell {
    padding: 8px 12px;
    border-inline-end: 1px solid var(--line);
    background: #fff;
  }
  .doc-meta .cell:last-child { border-inline-end: 0; }
  .doc-meta .cell .k {
    display: block;
    font-size: 10px; font-weight: 600;
    color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.6px; margin-bottom: 2px;
  }
  .doc-meta .cell .v {
    font-size: 12.5px; font-weight: 700; color: var(--ink);
  }

  /* ─── Section ─── */
  .section {
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .section > .sec-title {
    background: var(--panel-2);
    color: var(--ink);
    font-weight: 700;
    font-size: 11.5px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 8px;
    letter-spacing: 0.2px;
  }
  .section > .sec-title::before {
    content: '';
    width: 3px; height: 14px; background: var(--accent);
    border-radius: 2px;
  }
  .section > .sec-body { padding: 10px 12px; background: #fff; }

  .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
  .kv-grid .kv {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 5px 8px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 4px;
    font-size: 11px;
  }
  .kv-grid .kv .k { color: var(--muted); font-weight: 600; }
  .kv-grid .kv .v { color: var(--ink); font-weight: 700; }
  .kv-grid .kv.full { grid-column: 1 / -1; }

  /* ─── Items table ─── */
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th {
    background: var(--ink);
    color: #fff;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    text-align: start;
    letter-spacing: 0.3px;
  }
  table.items thead th.num { text-align: center; width: 30px; }
  table.items thead th.right { text-align: end; }
  table.items tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
  }
  table.items tbody tr:nth-child(even) td { background: var(--panel); }
  table.items tbody td.num   { text-align: center; color: var(--muted); }
  table.items tbody td.right { text-align: end; font-variant-numeric: tabular-nums; }
  table.items tbody td.strong { font-weight: 700; }
  table.items tfoot td {
    background: var(--panel-2);
    color: var(--ink);
    font-weight: 800;
    padding: 8px 10px;
    font-size: 11.5px;
    text-align: end;
  }

  /* ─── Totals ─── */
  .totals-wrap {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 12px;
    margin-top: 12px;
  }
  .totals { border: 1px solid var(--line-strong); border-radius: 6px; overflow: hidden; }
  .totals .row {
    display: flex; justify-content: space-between;
    padding: 7px 12px;
    font-size: 11.5px;
    border-bottom: 1px solid var(--line);
  }
  .totals .row:last-child { border-bottom: 0; }
  .totals .row .k { color: var(--muted); font-weight: 600; }
  .totals .row .v { color: var(--ink); font-weight: 700; font-variant-numeric: tabular-nums; }
  .totals .grand {
    background: var(--ink);
    color: #fff;
    border-bottom: 0;
    padding: 10px 12px;
  }
  .totals .grand .k { color: rgba(255,255,255,0.85); font-weight: 700; font-size: 12px; }
  .totals .grand .v { color: #fff; font-weight: 800; font-size: 14px; }

  .notes {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 10px 12px;
    background: #fff;
    color: var(--ink-2);
    font-size: 11px;
    min-height: 48px;
  }
  .notes .notes-label {
    display: block;
    font-size: 10px; font-weight: 700;
    color: var(--muted);
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  /* ─── Signature strip (workshop / recipient / beneficiary) ─── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 18px;
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .sig { text-align: center; }
  .sig .sig-label { font-size: 11px; font-weight: 700; color: var(--ink-2); margin-bottom: 30px; }
  .sig .sig-line  { border-top: 1px solid var(--line-strong); padding-top: 4px; font-size: 10px; color: var(--muted); }

  /* ─── Manager signature block (compact, centered card) ─── */
  .sig-card {
    margin-top: 18px;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 10px 14px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .sig-card .sig-left { display: flex; flex-direction: column; }
  .sig-card .sig-role {
    font-size: 10px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.6px;
  }
  .sig-card .sig-name { font-size: 13px; font-weight: 800; color: var(--ink); margin-top: 2px; }
  .sig-card .sig-right { display: flex; flex-direction: column; align-items: center; }
  .sig-card .sig-right img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .sig-card .sig-right .sig-label {
    border-top: 1px solid var(--line-strong);
    min-width: 140px;
    padding-top: 3px;
    margin-top: 2px;
    font-size: 10px; color: var(--muted);
    text-align: center;
  }

  /* ─── Company footer strip (horizontal, very bottom of page) ─── */
  .company-strip {
    margin-top: 16px;
    padding: 8px 10px 4px;
    border-top: 1px solid var(--accent);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: nowrap;
    font-size: 9.5px;
    color: var(--muted);
    line-height: 1.4;
  }
  .company-strip .company-logo {
    height: 30px; width: auto; object-fit: contain;
    flex-shrink: 0;
  }
  .company-strip .company-info {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 8px;
  }
  .company-strip .co-name {
    font-weight: 800; color: var(--ink); font-size: 11px;
    margin-inline-end: 2px;
  }
  .company-strip .co-sep { color: var(--line-strong); font-weight: 700; }
  .company-strip .co-item strong {
    color: var(--ink-2); font-weight: 700; margin-inline-end: 2px;
  }
  .company-strip .co-web {
    color: var(--accent); font-weight: 700; text-decoration: none;
    font-variant-numeric: tabular-nums;
  }

  /* Avoid page breaks inside critical blocks when printing. */
  .section, .totals, .sig-card, .signatures { page-break-inside: avoid; }
`

// ─── HTML helpers ────────────────────────────────────
export function esc(s: string | number | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export function fmtDate(iso: string | null | undefined, lang: PdfLang): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const locale = lang === 'ar' ? 'ar-SA' : 'en-GB'
  return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ─── Print-window engine (bilingual) ────────────────
export function openPrintWindow(html: string, lang: PdfLang, title = 'Document') {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) {
    alert('Please allow popups to export the PDF')
    return
  }
  const dir = isPdfLangRtl(lang) ? 'rtl' : 'ltr'
  w.document.write(`
    <!DOCTYPE html>
    <html lang="${lang}" dir="${dir}">
    <head>
      <meta charset="UTF-8" />
      <title>${esc(title)}</title>
      <style>${PDF_STYLES}</style>
    </head>
    <body>
      <div class="page">${html}</div>
      <script>
        Promise.all([
          document.fonts.ready,
          ...Array.from(document.images).map(function(img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function(resolve) {
              img.onload = resolve; img.onerror = resolve;
            });
          })
        ]).then(function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 450);
        });
      </script>
    </body>
    </html>
  `)
  w.document.close()
}

// ─── Manager signature block (replaces the old payment+signature card) ──
// Compact, horizontal: role + name on one side, signature image + label on
// the other. No banking info — that moved out of the footer entirely per
// the new design spec.
export interface ManagerSignatureArgs {
  serviceManagerName?: string
  signatureSrc?: string
}

export function managerSignatureBlock(lang: PdfLang, args: ManagerSignatureArgs = {}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const {
    serviceManagerName = lang === 'ar' ? 'مدير الصيانة' : 'Service Manager',
    signatureSrc       = `${origin}/images/sig.png`,
  } = args

  return `
    <div class="sig-card">
      <div class="sig-left">
        <span class="sig-role">${esc(L(lang, 'authorizedOfficer'))}</span>
        <span class="sig-name">${esc(serviceManagerName)}</span>
        <span class="sig-role" style="margin-top:2px;">${esc(L(lang, 'maintenanceManager'))}</span>
      </div>
      <div class="sig-right">
        <img src="${esc(signatureSrc)}" alt="signature"
             onerror="this.style.display='none'" />
        <div class="sig-label">${esc(L(lang, 'signature'))}</div>
      </div>
    </div>
  `
}

/**
 * Backward-compat shim — the old name is still imported in a few places.
 * Internally it now just renders the signature block (the banking columns
 * were removed from the footer per the new design spec).
 */
export function paymentFooterBlock(
  lang: PdfLang,
  args: { serviceManagerName?: string; signatureSrc?: string; [extra: string]: any } = {}
): string {
  return managerSignatureBlock(lang, {
    serviceManagerName: args.serviceManagerName,
    signatureSrc:       args.signatureSrc,
  })
}

// ─── Company footer strip (horizontal, at the very bottom) ──────
// Renders the official company-contact line required on every invoice
// and misuse-form PDF: logo · company name · unified number · chamber
// membership · phone · fax · ext · address · postal code · website.
// Kept compact (~30px tall) so it does NOT make the page taller.
export function companyFooterStrip(lang: PdfLang): string {
  const origin  = typeof window !== 'undefined' ? window.location.origin : ''
  const isAr    = lang === 'ar'
  const c       = COMPANY_INFO
  const sep     = '<span class="co-sep">·</span>'

  const pieces: string[] = [
    `<span class="co-name">${esc(isAr ? c.name_ar : c.name_en)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'unifiedNumber'))}:</strong>${esc(c.unifiedNumber)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'chamberMembership'))}:</strong>${esc(c.chamberMembership)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'phoneShort'))}:</strong>${esc(c.phone)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'faxShort'))}:</strong>${esc(c.fax)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'extensionShort'))}:</strong>${esc(c.extension)}</span>`,
    `<span class="co-item">${esc(isAr ? c.address_ar : c.address_en)}</span>`,
    `<span class="co-item"><strong>${esc(L(lang, 'postalCodeShort'))}:</strong>${esc(c.postalCode)}</span>`,
    `<a class="co-web" href="${esc(c.websiteUrl)}">${esc(c.websiteLabel)}</a>`,
  ]

  return `
    <div class="company-strip">
      <img src="${origin}/images/logo.png" alt="logo" class="company-logo"
           onerror="this.style.display='none'" />
      <div class="company-info">
        ${pieces.join(sep)}
      </div>
    </div>
  `
}

// ─── Language picker (tiny promise-based modal) ────────
/**
 * Shows a minimal, self-contained Ar/En picker overlay in the current page
 * and resolves with the chosen language. No React dependency so every
 * caller can use it with a single `await`.
 */
export function askPdfLanguage(defaultLang: PdfLang = 'ar'): Promise<PdfLang | null> {
  if (typeof window === 'undefined') return Promise.resolve(defaultLang)

  return new Promise<PdfLang | null>((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(15,23,42,0.55)',
      'z-index:99999', 'display:flex', 'align-items:center',
      'justify-content:center', 'font-family:system-ui,-apple-system,Segoe UI,Tahoma,Arial,sans-serif',
    ].join(';')

    const card = document.createElement('div')
    card.style.cssText = [
      'background:#fff', 'border-radius:12px', 'padding:20px 22px',
      'width:min(92vw,380px)', 'box-shadow:0 20px 50px rgba(0,0,0,0.25)',
      'text-align:center',
    ].join(';')

    card.innerHTML = `
      <div style="font-size:13px;color:#64748b;margin-bottom:4px;">Language · اللغة</div>
      <div style="font-size:16px;font-weight:800;color:#0b1220;margin-bottom:14px;">
        Choose the PDF language
        <div style="font-size:12px;font-weight:600;color:#64748b;margin-top:2px;">اختر لغة الملف</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button data-lang="ar" style="flex:1;padding:10px 16px;font-size:14px;font-weight:700;background:#B91C1C;color:#fff;border:none;border-radius:8px;cursor:pointer;">العربية</button>
        <button data-lang="en" style="flex:1;padding:10px 16px;font-size:14px;font-weight:700;background:#0b1220;color:#fff;border:none;border-radius:8px;cursor:pointer;">English</button>
      </div>
      <button data-cancel="1" style="margin-top:10px;padding:6px 10px;font-size:12px;background:transparent;color:#64748b;border:none;cursor:pointer;">Cancel · إلغاء</button>
    `

    overlay.appendChild(card)

    const cleanup = (v: PdfLang | null) => {
      document.removeEventListener('keydown', onKey)
      overlay.remove()
      resolve(v)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup(null)
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null)
    })
    card.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
      if (!btn) return
      if (btn.dataset.cancel) return cleanup(null)
      const lang = btn.dataset.lang as PdfLang | undefined
      if (lang === 'ar' || lang === 'en') cleanup(lang)
    })
    document.addEventListener('keydown', onKey)
    document.body.appendChild(overlay)
  })
}
