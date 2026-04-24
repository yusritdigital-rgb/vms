// =====================================================
// Misuse Registration PDF — formal, bilingual (ar/en).
// -----------------------------------------------------
// Matches the invoice document visually via the shared
// `./shared.ts` engine so all official documents print with
// the same corporate look.
// =====================================================

import {
  type MisuseRegistrationWithItems,
  formatCurrency,
  computeMisuseTotals,
} from '@/lib/misuse/types'
import {
  type PdfLang,
  L,
  esc,
  fmtDate,
  openPrintWindow,
  managerSignatureBlock,
  companyFooterStrip,
} from '@/lib/pdf/shared'

export function generateMisusePDF(mu: MisuseRegistrationWithItems, lang: PdfLang = 'ar') {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const currency = L(lang, 'currencySar')

  const laborRows = mu.labor_items.length
    ? mu.labor_items.map((it, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${esc(it.description) || '-'}</td>
          <td class="right strong">${esc(formatCurrency(Number(it.cost)))}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:12px;">${esc(L(lang, 'noItems'))}</td></tr>`

  const partsRows = mu.spare_part_items.length
    ? mu.spare_part_items.map((it, i) => {
        const line = Number(it.quantity || 0) * Number(it.unit_price || 0)
        return `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(it.part_name) || '-'}</td>
            <td class="right">${esc(formatCurrency(Number(it.quantity)))}</td>
            <td class="right">${esc(formatCurrency(Number(it.unit_price)))}</td>
            <td class="right strong">${esc(formatCurrency(line))}</td>
          </tr>`
      }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px;">${esc(L(lang, 'noItems'))}</td></tr>`

  const totals = computeMisuseTotals(
    mu.labor_items,
    mu.spare_part_items,
    Number(mu.discount_percentage || 0),
    Number(mu.vat_percentage || 0)
  )

  const orgName = lang === 'ar' ? 'شركة الأوائل' : 'Al-Awael Company'
  const orgSub  = lang === 'ar' ? 'نظام إدارة المركبات' : 'Vehicle Management System'

  const html = `
    <!-- Header -->
    <div class="doc-header">
      <div class="brand">
        <img src="${origin}/images/logo.png" alt="logo"
             onerror="this.style.display='none'" />
        <div>
          <div class="org-name">${esc(orgName)}</div>
          <div class="org-sub">${esc(orgSub)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">
          ${esc(L(lang, 'misuseTitle'))}
          <span class="sub">${lang === 'ar' ? 'MISUSE / REPAIR-COST CHARGE' : 'نموذج سوء الاستخدام'}</span>
        </div>
      </div>
    </div>

    <!-- Meta -->
    <div class="doc-meta">
      <div class="cell">
        <span class="k">${esc(L(lang, 'misuseNumber'))}</span>
        <span class="v">${esc(mu.registration_number)}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'dateLabel'))}</span>
        <span class="v">${esc(fmtDate(mu.registration_date, lang))}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'project'))}</span>
        <span class="v">${esc(mu.project_name) || '-'}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'plate'))}</span>
        <span class="v">${esc(mu.plate_number) || '-'}</span>
      </div>
    </div>

    <!-- Basic info -->
    <div class="section">
      <div class="sec-title">${esc(L(lang, 'basicInfo'))}</div>
      <div class="sec-body">
        <div class="kv-grid">
          <div class="kv"><span class="k">${esc(L(lang, 'vehicleType'))}</span><span class="v">${esc(mu.vehicle_type) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'project'))}</span><span class="v">${esc(mu.project_name) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'plate'))}</span><span class="v">${esc(mu.plate_number) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'dateLabel'))}</span><span class="v">${esc(fmtDate(mu.registration_date, lang))}</span></div>
        </div>
      </div>
    </div>

    <!-- Labor -->
    <div class="section">
      <div class="sec-title">${esc(L(lang, 'labor'))}</div>
      <div class="sec-body" style="padding:0;">
        <table class="items">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>${esc(L(lang, 'colDescription'))}</th>
              <th class="right">${esc(L(lang, 'colLineTotal'))} (${esc(currency)})</th>
            </tr>
          </thead>
          <tbody>${laborRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2">${esc(L(lang, 'laborTotalCost'))}</td>
              <td class="right">${esc(formatCurrency(totals.labor_total))} ${esc(currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Spare parts -->
    <div class="section">
      <div class="sec-title">${esc(L(lang, 'spareParts'))}</div>
      <div class="sec-body" style="padding:0;">
        <table class="items">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>${esc(L(lang, 'colPart'))}</th>
              <th class="right">${esc(L(lang, 'colQuantity'))}</th>
              <th class="right">${esc(L(lang, 'colUnitPrice'))}</th>
              <th class="right">${esc(L(lang, 'colLineTotal'))}</th>
            </tr>
          </thead>
          <tbody>${partsRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4">${esc(L(lang, 'partsTotalCost'))}</td>
              <td class="right">${esc(formatCurrency(totals.parts_total))} ${esc(currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Totals + notes -->
    <div class="totals-wrap">
      <div>
        <div class="notes">
          <span class="notes-label">${esc(L(lang, 'notes'))}</span>
          ${esc(mu.notes) || `<span style="color:#94a3b8;">${esc(L(lang, 'none'))}</span>`}
        </div>
      </div>
      <div class="totals">
        <div class="row">
          <span class="k">${esc(L(lang, 'subtotal'))}</span>
          <span class="v">${esc(formatCurrency(totals.subtotal))} ${esc(currency)}</span>
        </div>
        <div class="row">
          <span class="k">${esc(L(lang, 'discount'))} (${esc(Number(mu.discount_percentage) || 0)}%)</span>
          <span class="v">${esc(formatCurrency(totals.discount_amount))} ${esc(currency)}</span>
        </div>
        <div class="row">
          <span class="k">${esc(L(lang, 'vat'))} (${esc(Number(mu.vat_percentage) || 0)}%)</span>
          <span class="v">${esc(formatCurrency(totals.vat_amount))} ${esc(currency)}</span>
        </div>
        <div class="row grand">
          <span class="k">${esc(L(lang, 'grandTotal'))}</span>
          <span class="v">${esc(formatCurrency(totals.total))} ${esc(currency)}</span>
        </div>
      </div>
    </div>

    <!-- Payment information (bank & IBAN) -->
    <div style="margin-top: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc;">
      <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.6px;">
        ${lang === 'ar' ? 'معلومات الدفع' : 'Payment Information'}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <span style="font-size: 10px; color: #64748b;">${lang === 'ar' ? 'البنك' : 'Bank'}</span>
          <div style="font-size: 13px; font-weight: 700; color: #0b1220;">${lang === 'ar' ? 'بنك الرياض' : 'Riyadh Bank'}</div>
        </div>
        <div>
          <span style="font-size: 10px; color: #64748b;">${lang === 'ar' ? 'الايبان' : 'IBAN'}</span>
          <div style="font-size: 13px; font-weight: 700; color: #0b1220; font-family: monospace;">SA4520000001000409259940</div>
        </div>
      </div>
    </div>

    <!-- Service-manager signature (compact card) -->
    ${managerSignatureBlock(lang, { serviceManagerName: lang === 'ar' ? 'محمد فوزي' : 'Mohammed Fawzi' })}

    <!-- Company footer strip — horizontal, sticks to the bottom edge -->
    ${companyFooterStrip(lang)}
  `

  openPrintWindow(html, lang, `Misuse ${mu.registration_number}`)
}
