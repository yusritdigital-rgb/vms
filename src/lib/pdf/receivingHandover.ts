// =====================================================
// Receiving/Handover Form (Vehicle Inspection Checklist)
// -----------------------------------------------------
// Uses form.png as the base template with Arabic text overlay.
// Generates printable forms for vehicle entry/exit during case
// opening and closing.
//
// Workflow:
// - Case opening: main vehicle = دخول, replacement = خروج
// - Case closing: main vehicle = خروج, replacement = دخول
// - If no replacement: still generate two forms (opening/closing)
// =====================================================

import {
  L,
  esc,
  fmtDate,
  openPrintWindow,
  companyFooterStrip,
  COMPANY_INFO,
} from '@/lib/pdf/shared'

export type MovementType = 'دخول' | 'خروج'

export interface VehicleHandoverData {
  plateNumber: string | null
  vehicleLabel: string // 'المركبة الأساسية' or 'المركبة البديلة'
  movementType: MovementType
  odometer?: number | null
  vehicleMakeModel?: string | null
  projectCode?: string | null
}

export interface ReceivingHandoverArgs {
  caseNumber: string | null
  caseDate: string | null // ISO
  workshop: string | null
  vehicles: VehicleHandoverData[]
  notes?: string | null
}

/**
 * Generate receiving/handover forms for case opening or closing.
 * Generates ONE page with all vehicles and their movement types.
 */
export function generateReceivingHandoverPDF(args: ReceivingHandoverArgs): void {
  const lang = 'ar' as const
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // Generate one page with all vehicles
  const pageHtml = `
    <div class="form-page">
      <!-- Header -->
      <div class="doc-header">
        <div class="header-left">
          <div class="doc-title">نموذج فحص المركبة</div>
          <div class="doc-subtitle">Vehicle Inspection Form</div>
        </div>
        <div class="header-right">
          <div class="case-info">
            <div class="info-row">
              <span class="info-label">رقم الحالة:</span>
              <span class="info-value">${esc(args.caseNumber) || '—'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">التاريخ:</span>
              <span class="info-value">${esc(fmtDate(args.caseDate, lang))}</span>
            </div>
            <div class="info-row">
              <span class="info-label">الورشة:</span>
              <span class="info-value">${esc(args.workshop) || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Vehicles Section - each with its own form.png -->
      <div class="vehicles-container">
        ${args.vehicles.map((vehicle, index) => `
          <div class="vehicle-section">
            <!-- Vehicle Info Card -->
            <div class="vehicle-card">
              <div class="vehicle-header">
                <span class="vehicle-label">${esc(vehicle.vehicleLabel)}</span>
                <span class="movement-badge movement-${vehicle.movementType === 'دخول' ? 'entry' : 'exit'}">${esc(vehicle.movementType)}</span>
              </div>
              <div class="vehicle-details">
                <div class="detail-row">
                  <span class="info-label">رقم اللوحة:</span>
                  <span class="info-value">${esc(vehicle.plateNumber) || '—'}</span>
                </div>
                <div class="detail-row">
                  <span class="info-label">نوع المركبة:</span>
                  <span class="info-value">${esc(vehicle.vehicleMakeModel) || '—'}</span>
                </div>
                ${vehicle.projectCode ? `
                <div class="detail-row">
                  <span class="info-label">المشروع:</span>
                  <span class="info-value">${esc(vehicle.projectCode)}</span>
                </div>
                ` : ''}
                ${vehicle.odometer != null ? `
                <div class="detail-row">
                  <span class="info-label">العداد:</span>
                  <span class="info-value">${esc(vehicle.odometer.toLocaleString('en-US'))} كم</span>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Form Image -->
            <div class="form-image-wrapper">
              <img src="${origin}/images/car.png" alt="Vehicle Inspection Form" class="form-image" />
            </div>

            <!-- Checklist -->
            <div class="checklist-wrapper">
              <div class="checklist-item">
                <span class="item-label">طفاية الحريق <span class="item-label-en">Fire Extinguisher</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">عدة السيارة <span class="item-label-en">Vehicle Tools Kit</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">الراديو <span class="item-label-en">Radio</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">الإطار الاحتياطي <span class="item-label-en">Spare Tire</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">مفتاح العجل <span class="item-label-en">Wheel Wrench</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">مثلث السلامة <span class="item-label-en">Warning Triangle</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">جهاز تحديد المواقع GPS <span class="item-label-en">GPS Device</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">اللوحة المرورية <span class="item-label-en">License Plate</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">المساحات <span class="item-label-en">Wiper Blades</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">غطاء الإطار <span class="item-label-en">Tire Cover</span></span>
                <div class="item-box"></div>
              </div>
              <div class="checklist-item">
                <span class="item-label">فرش أرضية <span class="item-label-en">Floor Mats</span></span>
                <div class="item-box"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Notes -->
      ${args.notes ? `
      <div class="notes-section">
        <div class="section-title">ملاحظات</div>
        <div class="notes-content">${esc(args.notes)}</div>
      </div>
      ` : ''}

      <!-- Signatures -->
      <div class="signatures-section">
        <div class="sig-block">
          <div class="sig-title">بيانات الموظف</div>
          <div class="sig-row">
            <span class="sig-label">الاسم:</span>
            <div class="sig-blank"></div>
          </div>
          <div class="sig-row">
            <span class="sig-label">رقم الجوال:</span>
            <div class="sig-blank"></div>
          </div>
          <div class="sig-row">
            <span class="sig-label">التوقيع:</span>
            <div class="sig-line"></div>
          </div>
        </div>
        <div class="sig-block">
          <div class="sig-title">بيانات العميل</div>
          <div class="sig-row">
            <span class="sig-label">الاسم:</span>
            <div class="sig-blank"></div>
          </div>
          <div class="sig-row">
            <span class="sig-label">رقم الجوال:</span>
            <div class="sig-blank"></div>
          </div>
          <div class="sig-row">
            <span class="sig-label">التوقيع:</span>
            <div class="sig-line"></div>
          </div>
        </div>
      </div>
    </div>
  `

  const html = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');

      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { 
        size: A4; 
        margin: 10mm;
      }
      @page :header, @page :footer {
        display: none;
      }

      @media print {
        @page {
          margin: 10mm;
        }
        body {
          margin: 0;
        }
        @top-center, @top-left, @top-right, 
        @bottom-center, @bottom-left, @bottom-right {
          content: none;
        }
      }

      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        font-size: 10px;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .form-page {
        width: 100%;
        min-height: 277mm;
        position: relative;
      }

      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #B91C1C;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }

      .header-left {
        flex: 1;
      }

      .doc-title {
        font-size: 16px;
        font-weight: 800;
        color: #000;
        margin-bottom: 2px;
      }

      .doc-subtitle {
        font-size: 9px;
        color: #64748b;
        font-weight: 600;
      }

      .header-right {
        flex: 1;
        display: flex;
        justify-content: flex-end;
      }

      .case-info {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 6px 10px;
        min-width: 160px;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 2px;
      }

      .info-label {
        font-weight: 600;
        color: #333;
        font-size: 9px;
      }

      .info-value {
        font-weight: 700;
        color: #000;
        font-size: 9px;
      }

      .vehicles-container {
        display: grid;
        grid-template-columns: ${args.vehicles.length === 1 ? '1fr' : '1fr 1fr'};
        gap: 12px;
        margin-bottom: 12px;
      }

      .vehicle-section {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .vehicle-card {
        border-bottom: 1px solid #e5e7eb;
      }

      .vehicle-header {
        background: #f1f5f9;
        padding: 5px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
      }

      .vehicle-label {
        font-weight: 800;
        font-size: 11px;
        color: #B91C1C;
      }

      .movement-badge {
        font-weight: 800;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .movement-entry {
        color: #16a34a;
        background: #dcfce7;
      }

      .movement-exit {
        color: #dc2626;
        background: #fee2e2;
      }

      .vehicle-details {
        padding: 6px 8px;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
      }

      .form-image-wrapper {
        padding: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
      }

      .form-image {
        max-width: 100%;
        max-height: 200px;
        object-fit: contain;
      }

      .checklist-wrapper {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .checklist-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .item-label {
        font-size: 9px;
        font-weight: 600;
        color: #333;
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .item-label-en {
        font-size: 8px;
        font-weight: 400;
        color: #64748b;
        margin-top: 1px;
      }

      .item-box {
        width: 16px;
        height: 16px;
        border: 1px solid #000;
        border-radius: 2px;
      }

      .notes-section {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        margin-bottom: 12px;
        overflow: hidden;
      }

      .section-title {
        background: #f1f5f9;
        padding: 5px 8px;
        font-weight: 700;
        font-size: 10px;
        color: #000;
        border-bottom: 1px solid #e5e7eb;
      }

      .notes-content {
        padding: 8px 10px;
        font-size: 9px;
        color: #000;
        line-height: 1.4;
        min-height: 30px;
      }

      .signatures-section {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }

      .sig-block {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 8px 10px;
      }

      .sig-title {
        font-weight: 700;
        font-size: 10px;
        color: #000;
        margin-bottom: 8px;
        text-align: center;
      }

      .sig-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .sig-label {
        font-weight: 600;
        color: #333;
        font-size: 9px;
        min-width: 70px;
      }

      .sig-blank {
        flex: 1;
        height: 18px;
        border: 1px solid #ccc;
        border-radius: 2px;
        background: #fafafa;
      }

      .sig-line {
        flex: 1;
        height: 1px;
        background: #000;
      }
    </style>

    ${pageHtml}

    ${companyFooterStrip(lang)}
  `

  const title = args.caseNumber
    ? `Handover Form ${args.caseNumber}`
    : 'Handover Form'
  openPrintWindow(html, lang, title)
}
