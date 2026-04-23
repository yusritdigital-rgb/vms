export interface PreventiveInspectionData {
  plateNumber: string
  driverName: string
  reserve: string
  printDate: string
  currentOdometer: number
  engineOilLevel: number
  radiatorWaterLevel: number
  brakeOilLevel: number
  tirePressure: number
  tireCondition: string
  brakeCondition: string
  frontLights: boolean
  rearLights: boolean
  turnSignals: boolean
  dashboardWarningLights: boolean
  engineSound: boolean
  steering: boolean
  underbody: boolean
  safetyEquipment: boolean
  spareTire: boolean
  tools: boolean
  interiorCleanliness: boolean
  exteriorCleanliness: boolean
}

export interface DeliveryAfterMaintenanceData {
  jobCardNumber: string
  creationDate: string
  deliveryDate: string
  workshopDuration: number
  plateNumber: string
  chassisNumber: string
  brand: string
  model: string
  entryOdometer: number
  exitOdometer: number
  workArea: string
  works: Array<{ description: string }>
  /**
   * Deprecated. The Cases workflow no longer tracks spare parts.
   * Kept optional only so historical call sites still compile; the
   * rendered PDF omits the section entirely when this is undefined.
   */
  spareParts?: Array<{ name: string; quantity: number }>
}

export interface ReceptionForMaintenanceData {
  plateNumber: string
  chassisNumber: string
  brand: string
  model: string
  dateTime: string
  entryOdometer: number
  type: 'accident' | 'mechanical'
  accidentSubType?: 'criminal' | 'accidental'
  workArea: string
  complaintDescription: string
  damages: Array<{ description: string }>
}

export interface MobileMaintenanceInventoryData {
  plateNumber: string
  date: string
  inventoryType: 'daily' | 'weekly' | 'monthly' | 'surprise'
}

// ─── Shared print engine using browser-native window.print() ───
// Uses Cairo font from Google Fonts for Arabic+Latin support.
// Works on Windows, Mac, iOS, Android — all platforms.

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4;
    margin: 15mm;
  }

  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
    font-size: 13px;
    color: #1e293b;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 0;
  }

  .header {
    text-align: center;
    border-bottom: 3px solid #B91C1C;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }

  .logo-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .logo-row img {
    height: 65px;
    width: auto;
    object-fit: contain;
  }

  .header .system-name {
    font-size: 28px;
    font-weight: 700;
    color: #B91C1C;
    letter-spacing: 2px;
  }

  .header .form-title {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin-top: 6px;
  }

  .header .form-date {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .info-item .label {
    font-weight: 600;
    color: #475569;
    font-size: 12px;
  }

  .info-item .value {
    font-weight: 700;
    color: #0f172a;
    font-size: 12px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 700;
    color: #B91C1C;
    margin: 16px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 2px solid #FECACA;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }

  table th {
    background: #B91C1C;
    color: white;
    padding: 8px 10px;
    text-align: start;
    font-size: 12px;
    font-weight: 600;
  }

  table td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
  }

  table tr:nth-child(even) td {
    background: #f8fafc;
  }

  .check-ok { color: #B91C1C; font-weight: 700; }
  .check-fail { color: #dc2626; font-weight: 700; }

  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }

  .sig-box .sig-rank {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
    margin-bottom: 26px;
  }

  .sig-box {
    text-align: center;
  }

  .sig-box .sig-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 30px;
  }

  .sig-box .sig-line {
    border-top: 1px solid #94a3b8;
    padding-top: 4px;
    font-size: 10px;
    color: #94a3b8;
  }

  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 10px;
    border-top: 2px solid #B91C1C;
    font-size: 11px;
    color: #64748b;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .complaint-box {
    padding: 10px 14px;
    background: #fefce8;
    border: 1px solid #fde68a;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 12px;
  }

  .complaint-box .complaint-label {
    font-weight: 600;
    color: #92400e;
    font-size: 11px;
    margin-bottom: 4px;
  }
`

function openPrintWindow(htmlContent: string, dir: 'rtl' | 'ltr') {
  const printWindow = window.open('', '_blank', 'width=800,height=1000')
  if (!printWindow) {
    alert('Please allow popups for printing')
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Print</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>
      <div class="print-page">
        ${htmlContent}
      </div>
      <script>
        // Wait for fonts AND images to load then print
        Promise.all([
          document.fonts.ready,
          ...Array.from(document.images).map(function(img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function(resolve) {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        ]).then(function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 400);
        });
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function logoHeader(formTitle: string, isAr: boolean, extra?: string, companyNameAr?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const showBothLogos = companyNameAr && /أوائل|awael|pioneer/i.test(companyNameAr)
  const logosHtml = showBothLogos
    ? `
      <img src="${origin}/images/logo.png" alt="logo" onerror="this.style.display='none'" />
      <div style="text-align:center;">
        <div class="system-name">VMS</div>
        <div class="form-title">${formTitle}</div>
        ${extra ? `<div class="form-date">${extra}</div>` : ''}
      </div>
      <img src="${origin}/images/logo.png" alt="logo2" onerror="this.style.display='none'" />
    `
    : `
      <div style="flex:1;"></div>
      <div style="text-align:center;">
        <div class="system-name">VMS</div>
        <div class="form-title">${formTitle}</div>
        ${extra ? `<div class="form-date">${extra}</div>` : ''}
      </div>
      <img src="${origin}/images/logo.png" alt="logo2" onerror="this.style.display='none'" />
    `
  return `
    <div class="header">
      <div class="logo-row">
        ${logosHtml}
      </div>
    </div>
  `
}

function boolIcon(val: boolean) {
  return val
    ? '<span class="check-ok">&#10003;</span>'
    : '<span class="check-fail">&#10007;</span>'
}

// ─── Form generators (return a print() action, not a jsPDF doc) ───

interface PrintAction {
  save: (filename: string) => void
}

function makePrintAction(html: string, dir: 'rtl' | 'ltr'): PrintAction {
  return {
    save: (_filename: string) => openPrintWindow(html, dir),
  }
}

export function generatePreventiveInspectionPDF(
  data: PreventiveInspectionData,
  language: 'ar' | 'en',
  companyNameAr?: string
): PrintAction {
  const isAr = language === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'

  const conditionLabel = (v: string) => {
    if (isAr) return v === 'good' ? 'جيد' : v === 'moderate' ? 'متوسط' : 'غير جيد'
    return v === 'good' ? 'Good' : v === 'moderate' ? 'Moderate' : 'Not Good'
  }

  const checkItems = [
    { key: 'frontLights', ar: 'الأضواء الأمامية', en: 'Front Lights', val: data.frontLights },
    { key: 'rearLights', ar: 'الأضواء الخلفية', en: 'Rear Lights', val: data.rearLights },
    { key: 'turnSignals', ar: 'إشارات الانعطاف', en: 'Turn Signals', val: data.turnSignals },
    { key: 'dashboardWarningLights', ar: 'أضواء التحذير', en: 'Dashboard Warning Lights', val: data.dashboardWarningLights },
    { key: 'engineSound', ar: 'صوت المحرك', en: 'Engine Sound', val: data.engineSound },
    { key: 'steering', ar: 'المقود', en: 'Steering', val: data.steering },
    { key: 'underbody', ar: 'أسفل الهيكل', en: 'Underbody', val: data.underbody },
    { key: 'safetyEquipment', ar: 'معدات السلامة', en: 'Safety Equipment', val: data.safetyEquipment },
    { key: 'spareTire', ar: 'الإطار الاحتياطي', en: 'Spare Tire', val: data.spareTire },
    { key: 'tools', ar: 'الأدوات', en: 'Tools', val: data.tools },
    { key: 'interiorCleanliness', ar: 'نظافة الداخل', en: 'Interior Cleanliness', val: data.interiorCleanliness },
    { key: 'exteriorCleanliness', ar: 'نظافة الخارج', en: 'Exterior Cleanliness', val: data.exteriorCleanliness },
  ]

  const html = `
    ${logoHeader(isAr ? 'نموذج الفحص الوقائي للمركبات' : 'Preventive Vehicle Inspection Form', isAr, data.printDate, companyNameAr)}

    <div class="info-grid">
      <div class="info-item">
        <span class="label">${isAr ? 'رقم اللوحة' : 'Plate Number'}</span>
        <span class="value">${data.plateNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'اسم السائق' : 'Driver Name'}</span>
        <span class="value">${data.driverName}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'المحمية' : 'Reserve'}</span>
        <span class="value">${data.reserve}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'قراءة العداد' : 'Odometer'}</span>
        <span class="value">${data.currentOdometer.toLocaleString()}</span>
      </div>
    </div>

    <div class="section-title">${isAr ? 'مستويات السوائل' : 'Fluid Levels'}</div>
    <table>
      <thead>
        <tr>
          <th>${isAr ? 'البند' : 'Item'}</th>
          <th>${isAr ? 'المستوى' : 'Level'}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>${isAr ? 'مستوى زيت المحرك' : 'Engine Oil Level'}</td><td>${data.engineOilLevel}%</td></tr>
        <tr><td>${isAr ? 'مستوى ماء الرادياتير' : 'Radiator Water Level'}</td><td>${data.radiatorWaterLevel}%</td></tr>
        <tr><td>${isAr ? 'مستوى زيت الفرامل' : 'Brake Oil Level'}</td><td>${data.brakeOilLevel}%</td></tr>
        <tr><td>${isAr ? 'ضغط الإطارات' : 'Tire Pressure'}</td><td>${data.tirePressure}%</td></tr>
      </tbody>
    </table>

    <div class="section-title">${isAr ? 'حالة القطع' : 'Component Condition'}</div>
    <table>
      <thead>
        <tr>
          <th>${isAr ? 'البند' : 'Item'}</th>
          <th>${isAr ? 'الحالة' : 'Condition'}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>${isAr ? 'حالة الإطارات' : 'Tire Condition'}</td><td>${conditionLabel(data.tireCondition)}</td></tr>
        <tr><td>${isAr ? 'حالة الفرامل' : 'Brake Condition'}</td><td>${conditionLabel(data.brakeCondition)}</td></tr>
      </tbody>
    </table>

    <div class="section-title">${isAr ? 'فحص البنود' : 'Inspection Checklist'}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${isAr ? 'البند' : 'Item'}</th>
          <th>${isAr ? 'الحالة' : 'Status'}</th>
        </tr>
      </thead>
      <tbody>
        ${checkItems.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${isAr ? item.ar : item.en}</td>
            <td>${boolIcon(item.val)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'المندوب الفني للجهة المستفيدة' : 'Technical Representative'}</div>
        <div class="sig-rank">${isAr ? 'الرتبة: ..................' : 'Rank: ..................'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'مشرف شركة الأوائل' : 'Al-Awael Company Supervisor'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'فني الشركة الموجرة' : 'Contracted Company Technician'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
    </div>

    <div class="footer">VMS</div>
  `

  return makePrintAction(html, dir)
}

export function generateDeliveryAfterMaintenancePDF(
  data: DeliveryAfterMaintenanceData,
  language: 'ar' | 'en',
  companyNameAr?: string
): PrintAction {
  const isAr = language === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'

  const worksRows = data.works.length > 0
    ? data.works.map((w, i) => `<tr><td>${i + 1}</td><td>${w.description}</td></tr>`).join('')
    : `<tr><td colspan="2" style="text-align:center;color:#94a3b8;">${isAr ? 'لا توجد أعمال' : 'No works'}</td></tr>`

  // Spare parts section retained only if the caller explicitly provides
  // a non-empty array. Empty / undefined -> the section is not rendered.
  const sparePartsList = Array.isArray(data.spareParts) ? data.spareParts : []
  const partsSection = sparePartsList.length > 0
    ? `
      <div class="section-title">${isAr ? 'قطع الغيار المستخدمة' : 'Spare Parts Used'}</div>
      <table>
        <thead><tr><th>#</th><th>${isAr ? 'القطعة' : 'Part'}</th><th>${isAr ? 'الكمية' : 'Qty'}</th></tr></thead>
        <tbody>${sparePartsList.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.quantity}</td></tr>`).join('')}</tbody>
      </table>`
    : ''

  const html = `
    ${logoHeader(isAr ? 'نموذج تسليم مركبة بعد الصيانة' : 'Vehicle Delivery After Maintenance Form', isAr, undefined, companyNameAr)}

    <div class="info-grid">
      <div class="info-item">
        <span class="label">${isAr ? 'رقم كرت العمل' : 'Job Card Number'}</span>
        <span class="value">${data.jobCardNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'رقم اللوحة' : 'Plate Number'}</span>
        <span class="value">${data.plateNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'رقم الشاصي' : 'Chassis Number'}</span>
        <span class="value">${data.chassisNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'الماركة / الموديل' : 'Brand / Model'}</span>
        <span class="value">${data.brand} ${data.model}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'تاريخ الإنشاء' : 'Creation Date'}</span>
        <span class="value">${data.creationDate}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'تاريخ التسليم' : 'Delivery Date'}</span>
        <span class="value">${data.deliveryDate}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'عداد الدخول' : 'Entry Odometer'}</span>
        <span class="value">${data.entryOdometer.toLocaleString()}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'عداد الخروج' : 'Exit Odometer'}</span>
        <span class="value">${data.exitOdometer.toLocaleString()}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'منطقة عمل المركبة' : 'Vehicle Work Area'}</span>
        <span class="value">${data.workArea || '-'}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'مدة الورشة' : 'Workshop Duration'}</span>
        <span class="value">${data.workshopDuration} ${isAr ? 'يوم' : 'days'}</span>
      </div>
    </div>

    <div class="section-title">${isAr ? 'الأعمال المنفذة' : 'Works Performed'}</div>
    <table>
      <thead><tr><th>#</th><th>${isAr ? 'الوصف' : 'Description'}</th></tr></thead>
      <tbody>${worksRows}</tbody>
    </table>

    ${partsSection}

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'المندوب الفني للجهة المستفيدة' : 'Technical Representative'}</div>
        <div class="sig-rank">${isAr ? 'الرتبة: ..................' : 'Rank: ..................'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'مشرف شركة الأوائل' : 'Al-Awael Company Supervisor'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'فني الشركة الموجرة' : 'Contracted Company Technician'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
    </div>

    <div class="footer">VMS</div>
  `

  return makePrintAction(html, dir)
}

export function generateReceptionForMaintenancePDF(
  data: ReceptionForMaintenanceData,
  language: 'ar' | 'en',
  companyNameAr?: string
): PrintAction {
  const isAr = language === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const typeLabel = isAr ? (data.type === 'accident' ? 'حادث' : 'ميكانيكي') : (data.type === 'accident' ? 'Accident' : 'Mechanical')

  const damageRows = data.damages.length > 0
    ? data.damages.map((d, i) => `<tr><td>${i + 1}</td><td>${d.description}</td></tr>`).join('')
    : `<tr><td colspan="2" style="text-align:center;color:#94a3b8;">${isAr ? 'لا توجد أضرار مسجلة' : 'No damages recorded'}</td></tr>`

  const html = `
    ${logoHeader(isAr ? 'نموذج استلام مركبة للصيانة' : 'Vehicle Reception for Maintenance Form', isAr, undefined, companyNameAr)}

    <div class="info-grid">
      <div class="info-item">
        <span class="label">${isAr ? 'رقم اللوحة' : 'Plate Number'}</span>
        <span class="value">${data.plateNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'رقم الشاصي' : 'Chassis Number'}</span>
        <span class="value">${data.chassisNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'الماركة / الموديل' : 'Brand / Model'}</span>
        <span class="value">${data.brand} ${data.model}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'نوع كرت العمل' : 'Type'}</span>
        <span class="value">${typeLabel}${data.accidentSubType ? ` - ${isAr ? (data.accidentSubType === 'criminal' ? 'جنائي' : 'عرضي') : (data.accidentSubType === 'criminal' ? 'Criminal' : 'Accidental')}` : ''}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'منطقة عمل المركبة' : 'Vehicle Work Area'}</span>
        <span class="value">${data.workArea || '-'}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'التاريخ والوقت' : 'Date & Time'}</span>
        <span class="value">${data.dateTime}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'عداد الدخول' : 'Entry Odometer'}</span>
        <span class="value">${data.entryOdometer.toLocaleString()}</span>
      </div>
    </div>

    ${data.complaintDescription ? `
      <div class="complaint-box">
        <div class="complaint-label">${isAr ? 'وصف الشكوى' : 'Complaint Description'}</div>
        <div>${data.complaintDescription}</div>
      </div>
    ` : ''}

    <div class="section-title">${isAr ? 'الأضرار' : 'Damages'}</div>
    <table>
      <thead><tr><th>#</th><th>${isAr ? 'الوصف' : 'Description'}</th></tr></thead>
      <tbody>${damageRows}</tbody>
    </table>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'المندوب الفني للجهة المستفيدة' : 'Technical Representative'}</div>
        <div class="sig-rank">${isAr ? 'الرتبة: ..................' : 'Rank: ..................'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'مشرف شركة الأوائل' : 'Al-Awael Company Supervisor'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'فني الشركة الموجرة' : 'Contracted Company Technician'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
    </div>

    <div class="footer">VMS</div>
  `

  return makePrintAction(html, dir)
}

export function generateMobileMaintenanceInventoryPDF(
  data: MobileMaintenanceInventoryData,
  language: 'ar' | 'en',
  companyNameAr?: string
): PrintAction {
  const isAr = language === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'

  const typeLabels: Record<string, { ar: string; en: string }> = {
    daily: { ar: 'يومي', en: 'Daily' },
    weekly: { ar: 'أسبوعي', en: 'Weekly' },
    monthly: { ar: 'شهري', en: 'Monthly' },
    surprise: { ar: 'مفاجئ', en: 'Surprise' },
  }

  const inventoryItems = [
    { ar: 'رافعة هيدروليكية', en: 'Hydraulic Jack' },
    { ar: 'طقم مفاتيح', en: 'Wrench Set' },
    { ar: 'كشاف يدوي', en: 'Flashlight' },
    { ar: 'زيت محرك احتياطي', en: 'Spare Engine Oil' },
    { ar: 'ماء رادياتير', en: 'Radiator Water' },
    { ar: 'فلاتر احتياطية', en: 'Spare Filters' },
    { ar: 'إطار احتياطي', en: 'Spare Tire' },
    { ar: 'مطفأة حريق', en: 'Fire Extinguisher' },
    { ar: 'حقيبة إسعافات أولية', en: 'First Aid Kit' },
    { ar: 'مثلث تحذير', en: 'Warning Triangle' },
    { ar: 'كابلات شحن بطارية', en: 'Battery Jumper Cables' },
    { ar: 'حبل سحب', en: 'Tow Rope' },
  ]

  const html = `
    ${logoHeader(isAr ? 'نموذج جرد سيارة صيانة متنقلة' : 'Mobile Maintenance Vehicle Inventory Form', isAr, undefined, companyNameAr)}

    <div class="info-grid">
      <div class="info-item">
        <span class="label">${isAr ? 'رقم اللوحة' : 'Plate Number'}</span>
        <span class="value">${data.plateNumber}</span>
      </div>
      <div class="info-item">
        <span class="label">${isAr ? 'التاريخ' : 'Date'}</span>
        <span class="value">${data.date}</span>
      </div>
      <div class="info-item full-width">
        <span class="label">${isAr ? 'نوع الجرد' : 'Inventory Type'}</span>
        <span class="value">${isAr ? typeLabels[data.inventoryType].ar : typeLabels[data.inventoryType].en}</span>
      </div>
    </div>

    <div class="section-title">${isAr ? 'قائمة الجرد' : 'Inventory Checklist'}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${isAr ? 'البند' : 'Item'}</th>
          <th>${isAr ? 'موجود' : 'Available'}</th>
          <th>${isAr ? 'الحالة' : 'Condition'}</th>
          <th>${isAr ? 'ملاحظات' : 'Notes'}</th>
        </tr>
      </thead>
      <tbody>
        ${inventoryItems.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${isAr ? item.ar : item.en}</td>
            <td style="width:60px;"></td>
            <td style="width:80px;"></td>
            <td style="width:120px;"></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'المندوب الفني للجهة المستفيدة' : 'Technical Representative'}</div>
        <div class="sig-rank">${isAr ? 'الرتبة: ..................' : 'Rank: ..................'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'مشرف شركة الأوائل' : 'Al-Awael Company Supervisor'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${isAr ? 'فني الشركة الموجرة' : 'Contracted Company Technician'}</div>
        <div class="sig-line">${isAr ? 'التوقيع' : 'Signature'}</div>
      </div>
    </div>

    <div class="footer">VMS</div>
  `

  return makePrintAction(html, dir)
}
