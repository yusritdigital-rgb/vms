// =====================================================
// Invoice PDF — formal, bilingual (ar/en).
// -----------------------------------------------------
// Uses the shared official-document engine in `./shared.ts`:
//   - reduced red (accent-only) corporate palette
//   - bilingual labels via L(lang, key)
//   - standard payment-information + service-manager signature footer
// =====================================================

import {
  type InvoiceWithItems,
  ITEM_TYPE_LABEL_AR,
  STATUS_LABEL_AR,
  INTERNAL_WORKSHOP_EN,
  formatCurrency,
} from '@/lib/invoices/types'
import {
  type PdfLang,
  L,
  esc,
  fmtDate,
  openPrintWindow,
  companyFooterStrip,
} from '@/lib/pdf/shared'

const ITEM_TYPE_LABEL_EN: Record<string, string> = {
  spare_part: 'Spare Part',
  labor:      'Labor',
  service:    'Service',
  other:      'Other',
}

const STATUS_LABEL_EN: Record<string, string> = {
  draft:     'Draft',
  issued:    'Issued',
  cancelled: 'Cancelled',
}

function labelItemType(key: string, lang: PdfLang): string {
  const dict = (lang === 'ar' ? ITEM_TYPE_LABEL_AR : ITEM_TYPE_LABEL_EN) as Record<string, string>
  return dict[key] ?? key
}

function labelStatus(key: string, lang: PdfLang): string {
  const dict = (lang === 'ar' ? STATUS_LABEL_AR : STATUS_LABEL_EN) as Record<string, string>
  return dict[key] ?? key
}

/**
 * Generate and print an invoice PDF in the chosen language.
 *
 * Data in `inv` is preserved as-is (plate, vehicle, beneficiary, items, totals) —
 * only the labels, direction and formatting switch with `lang`.
 */
export function generateInvoicePDF(inv: InvoiceWithItems, lang: PdfLang = 'ar', creatorName?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const currency = L(lang, 'currencySar')

  const rows = inv.items.length
    ? inv.items.map((it, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${esc(labelItemType(it.item_type, lang))}</td>
          <td>${esc(it.description) || '-'}</td>
          <td class="num">${esc(it.quantity)}</td>
          <td class="right">${esc(formatCurrency(Number(it.unit_price)))}</td>
          <td class="right strong">${esc(formatCurrency(Number(it.quantity) * Number(it.unit_price)))}</td>
        </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">${esc(L(lang, 'noItems'))}</td></tr>`

  const html = `
    <!-- Header -->
    <div class="doc-header">
      <div class="brand">
        <img src="${origin}/images/logo.png" alt="logo"
             onerror="this.style.display='none'" />
        <div>
          <div class="org-name">${esc(inv.workshop_name)}</div>
          <div class="org-sub">${esc(INTERNAL_WORKSHOP_EN)}</div>
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">
          ${esc(L(lang, 'invoiceTitle'))}
          <span class="sub">${lang === 'ar' ? 'INTERNAL INVOICE' : 'فاتورة داخلية'}</span>
        </div>
      </div>
    </div>

    <!-- Meta strip -->
    <div class="doc-meta">
      <div class="cell">
        <span class="k">${esc(L(lang, 'invoiceNumber'))}</span>
        <span class="v">${esc(inv.invoice_number)}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'dateLabel'))}</span>
        <span class="v">${esc(fmtDate(inv.invoice_date, lang))}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'status'))}</span>
        <span class="v">${esc(labelStatus(inv.status, lang))}</span>
      </div>
      <div class="cell">
        <span class="k">${esc(L(lang, 'repairType'))}</span>
        <span class="v">${esc(inv.repair_type) || '-'}</span>
      </div>
    </div>

    <!-- Vehicle / beneficiary -->
    <div class="section">
      <div class="sec-title">${esc(L(lang, 'vehicleAndBeneficiary'))}</div>
      <div class="sec-body">
        <div class="kv-grid">
          <div class="kv"><span class="k">${esc(L(lang, 'plate'))}</span><span class="v">${esc(inv.vehicle_plate) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'vehicle'))}</span><span class="v">${esc(inv.vehicle_label) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'project'))}</span><span class="v">${esc(inv.project) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'workshop'))}</span><span class="v">${esc(inv.workshop_name)}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'issuedTo'))}</span><span class="v">${esc(inv.beneficiary_company) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'maintenanceManager'))}</span><span class="v">${esc(inv.maintenance_manager) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'technician'))}</span><span class="v">${esc(inv.technician) || '-'}</span></div>
          <div class="kv"><span class="k">${esc(L(lang, 'workHours'))}</span><span class="v">${esc(inv.work_hours ?? 0)}</span></div>
        </div>
      </div>
    </div>

    <!-- Items -->
    <div class="section">
      <div class="sec-title">${esc(L(lang, 'invoiceItems'))}</div>
      <div class="sec-body" style="padding:0;">
        <table class="items">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>${esc(L(lang, 'colType'))}</th>
              <th>${esc(L(lang, 'colDescription'))}</th>
              <th class="num">${esc(L(lang, 'colQuantity'))}</th>
              <th class="right">${esc(L(lang, 'colUnitPrice'))}</th>
              <th class="right">${esc(L(lang, 'colLineTotal'))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <!-- Totals + notes -->
    <div class="totals-wrap">
      <div>
        <div class="notes">
          <span class="notes-label">${esc(L(lang, 'notes'))}</span>
          ${esc(inv.notes) || `<span style="color:#94a3b8;">${esc(L(lang, 'none'))}</span>`}
        </div>
      </div>
      <div class="totals">
        <div class="row">
          <span class="k">${esc(L(lang, 'subtotal'))}</span>
          <span class="v">${esc(formatCurrency(Number(inv.subtotal)))} ${esc(currency)}</span>
        </div>
        <div class="row">
          <span class="k">${esc(L(lang, 'vat'))} (${esc(inv.vat_percentage)}%)</span>
          <span class="v">${esc(formatCurrency(Number(inv.vat_amount)))} ${esc(currency)}</span>
        </div>
        <div class="row grand">
          <span class="k">${esc(L(lang, 'grandTotal'))}</span>
          <span class="v">${esc(formatCurrency(Number(inv.total)))} ${esc(currency)}</span>
        </div>
      </div>
    </div>

    <!-- Invoice creator -->
    <div class="invoice-creator">
      ${lang === 'ar' ? 'أنشأ الفاتورة:' : 'Created by:'} ${esc(creatorName || inv.created_by || '-')}
    </div>

    <!-- Company footer strip — horizontal, sticks to the bottom edge -->
    ${companyFooterStrip(lang)}
  `

  openPrintWindow(html, lang, `Invoice ${inv.invoice_number}`)
}
