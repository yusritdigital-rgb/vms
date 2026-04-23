import ExcelJS from 'exceljs'

// ═══════════════════════════════════════════════════════════════════════════
// Excel Form Templates - Professional, Empty, Editable
// ═══════════════════════════════════════════════════════════════════════════

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB91C1C' } }
const HEADER_FONT = { name: 'Cairo', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
const SECTION_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEE2E2' } }
const SECTION_FONT = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFB91C1C' } }
const LABEL_FONT = { name: 'Cairo', size: 10, bold: true }
const VALUE_FONT = { name: 'Cairo', size: 10 }
const BORDER_STYLE = { style: 'thin' as const, color: { argb: 'FF9E9E9E' } }

function addBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: BORDER_STYLE,
    left: BORDER_STYLE,
    bottom: BORDER_STYLE,
    right: BORDER_STYLE,
  }
}

async function addHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
  titleEn: string,
  workbook: ExcelJS.Workbook,
  companyNameAr?: string   // ← اسم الشركة لتحديد اللوجو
) {
  const isAwaelCompany = companyNameAr && /أوائل|awael|pioneer/i.test(companyNameAr)

  worksheet.mergeCells('A1:F1')
  const headerCell = worksheet.getCell('A1')
  headerCell.value = 'نظام مراقبة المركبات - VMS'
  headerCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FFB91C1C' } }
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  // Row 2: Logos + Title (modern layout)
  worksheet.getRow(2).height = 70

  // دائماً اعرض logo.png
  try {
    const logo2Response = await fetch('/images/logo.png')
    const logo2Blob = await logo2Response.blob()
    const logo2Base64 = await blobToBase64(logo2Blob)
    const logo2Id = workbook.addImage({ base64: logo2Base64, extension: 'png' })
    worksheet.addImage(logo2Id, {
      tl: { col: 0, row: 1 },
      ext: { width: 80, height: 60 },
      editAs: 'oneCell',
    })
  } catch (e) {
    console.warn('Could not load logo.png')
  }

  // logo.png فقط للأوائل
  if (isAwaelCompany) {
    try {
      const logo1Response = await fetch('/images/logo.png')
      const logo1Blob = await logo1Response.blob()
      const logo1Base64 = await blobToBase64(logo1Blob)
      const logo1Id = workbook.addImage({ base64: logo1Base64, extension: 'png' })
      worksheet.addImage(logo1Id, {
        tl: { col: 5, row: 1 },
        ext: { width: 60, height: 60 },
        editAs: 'oneCell',
      })
    } catch (e) {
      console.warn('Could not load logo.png')
    }
  }

  // Title in the center
  worksheet.mergeCells('B2:E2')
  const titleCell = worksheet.getCell('B2')
  titleCell.value = `${title}\n${titleEn}`
  titleCell.font = { name: 'Cairo', size: 14, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  worksheet.addRow([])
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Reception for Maintenance Form (استمارة استقبال للصيانة)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateReceptionForMaintenanceExcel(language: 'ar' | 'en' = 'ar') {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(language === 'ar' ? 'استمارة استقبال' : 'Reception Form', {
    properties: { defaultRowHeight: 20 },
    views: [{ rightToLeft: language === 'ar' }],
  })

  worksheet.columns = [
    { width: 25 }, { width: 20 }, { width: 25 }, { width: 20 }, { width: 25 }, { width: 20 },
  ]

  await addHeader(worksheet, 'استمارة استقبال للصيانة', 'Reception for Maintenance Form', workbook)

  let currentRow = 4

  // Vehicle Information Section
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const sectionCell1 = worksheet.getCell(`A${currentRow}`)
  sectionCell1.value = language === 'ar' ? 'بيانات المركبة' : 'Vehicle Information'
  sectionCell1.fill = SECTION_FILL
  sectionCell1.font = SECTION_FONT
  sectionCell1.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(sectionCell1)
  currentRow++

  const vehicleFields = [
    { label: 'رقم اللوحة', labelEn: 'Plate Number', col: 'A' },
    { label: 'رقم الشاصي', labelEn: 'Chassis Number', col: 'C' },
    { label: 'الماركة', labelEn: 'Brand', col: 'E' },
  ]

  vehicleFields.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow++

  const vehicleFields2 = [
    { label: 'الموديل', labelEn: 'Model', col: 'A' },
    { label: 'تاريخ ووقت الاستقبال', labelEn: 'Date & Time', col: 'C' },
    { label: 'قراءة العداد', labelEn: 'Odometer', col: 'E' },
  ]

  vehicleFields2.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow += 2

  // Maintenance Type Section
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const sectionCell2 = worksheet.getCell(`A${currentRow}`)
  sectionCell2.value = language === 'ar' ? 'نوع الصيانة' : 'Maintenance Type'
  sectionCell2.fill = SECTION_FILL
  sectionCell2.font = SECTION_FONT
  sectionCell2.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(sectionCell2)
  currentRow++

  const typeRow = worksheet.getRow(currentRow)
  typeRow.getCell(1).value = language === 'ar' ? '☐ ميكانيكية' : '☐ Mechanical'
  typeRow.getCell(1).font = VALUE_FONT
  typeRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
  addBorders(typeRow.getCell(1))

  typeRow.getCell(2).value = language === 'ar' ? '☐ حادث' : '☐ Accident'
  typeRow.getCell(2).font = VALUE_FONT
  typeRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
  addBorders(typeRow.getCell(2))

  typeRow.getCell(3).value = language === 'ar' ? 'منطقة العمل:' : 'Work Area:'
  typeRow.getCell(3).font = LABEL_FONT
  typeRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
  addBorders(typeRow.getCell(3))

  worksheet.mergeCells(`D${currentRow}:F${currentRow}`)
  const workAreaCell = typeRow.getCell(4)
  workAreaCell.value = ''
  workAreaCell.font = VALUE_FONT
  workAreaCell.alignment = { horizontal: 'left', vertical: 'middle' }
  addBorders(workAreaCell)
  currentRow += 2

  // Complaint Description
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const complaintHeader = worksheet.getCell(`A${currentRow}`)
  complaintHeader.value = language === 'ar' ? 'وصف الشكوى / العطل' : 'Complaint / Issue Description'
  complaintHeader.fill = SECTION_FILL
  complaintHeader.font = SECTION_FONT
  complaintHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(complaintHeader)
  currentRow++

  for (let i = 0; i < 4; i++) {
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const descCell = worksheet.getCell(`A${currentRow}`)
    descCell.value = ''
    descCell.font = VALUE_FONT
    descCell.alignment = { horizontal: 'right', vertical: 'top', wrapText: true }
    addBorders(descCell)
    worksheet.getRow(currentRow).height = 25
    currentRow++
  }

  currentRow++

  // Damages Section
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const damagesHeader = worksheet.getCell(`A${currentRow}`)
  damagesHeader.value = language === 'ar' ? 'الأضرار الظاهرة' : 'Visible Damages'
  damagesHeader.fill = SECTION_FILL
  damagesHeader.font = SECTION_FONT
  damagesHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(damagesHeader)
  currentRow++

  for (let i = 0; i < 5; i++) {
    const damageRow = worksheet.getRow(currentRow)
    damageRow.getCell(1).value = `${i + 1}.`
    damageRow.getCell(1).font = LABEL_FONT
    damageRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(damageRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const damageCell = damageRow.getCell(2)
    damageCell.value = ''
    damageCell.font = VALUE_FONT
    damageCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(damageCell)
    currentRow++
  }

  currentRow += 2

  // Signatures
  const sigRow = worksheet.getRow(currentRow)
  sigRow.getCell(1).value = language === 'ar' ? 'توقيع المستلم:' : 'Receiver Signature:'
  sigRow.getCell(1).font = LABEL_FONT
  addBorders(sigRow.getCell(1))
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`)
  addBorders(sigRow.getCell(2))

  sigRow.getCell(4).value = language === 'ar' ? 'توقيع المسلم:' : 'Deliverer Signature:'
  sigRow.getCell(4).font = LABEL_FONT
  addBorders(sigRow.getCell(4))
  worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
  addBorders(sigRow.getCell(5))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Delivery After Maintenance Form (استمارة تسليم بعد الصيانة)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateDeliveryAfterMaintenanceExcel(language: 'ar' | 'en' = 'ar') {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(language === 'ar' ? 'استمارة تسليم' : 'Delivery Form', {
    properties: { defaultRowHeight: 20 },
    views: [{ rightToLeft: language === 'ar' }],
  })

  worksheet.columns = [
    { width: 25 }, { width: 20 }, { width: 25 }, { width: 20 }, { width: 25 }, { width: 20 },
  ]

  await addHeader(worksheet, 'استمارة تسليم بعد الصيانة', 'Delivery After Maintenance Form', workbook)

  let currentRow = 4

  // Job Card Info
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const sectionCell1 = worksheet.getCell(`A${currentRow}`)
  sectionCell1.value = language === 'ar' ? 'بيانات كرت العمل' : 'Job Card Information'
  sectionCell1.fill = SECTION_FILL
  sectionCell1.font = SECTION_FONT
  sectionCell1.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(sectionCell1)
  currentRow++

  const jobFields = [
    { label: 'رقم كرت العمل', labelEn: 'Job Card Number', col: 'A' },
    { label: 'تاريخ الإنشاء', labelEn: 'Creation Date', col: 'C' },
    { label: 'تاريخ التسليم', labelEn: 'Delivery Date', col: 'E' },
  ]

  jobFields.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow += 2

  // Vehicle Information
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const sectionCell2 = worksheet.getCell(`A${currentRow}`)
  sectionCell2.value = language === 'ar' ? 'بيانات المركبة' : 'Vehicle Information'
  sectionCell2.fill = SECTION_FILL
  sectionCell2.font = SECTION_FONT
  sectionCell2.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(sectionCell2)
  currentRow++

  const vehicleFields = [
    { label: 'رقم اللوحة', labelEn: 'Plate Number', col: 'A' },
    { label: 'رقم الشاصي', labelEn: 'Chassis Number', col: 'C' },
    { label: 'الماركة', labelEn: 'Brand', col: 'E' },
  ]

  vehicleFields.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow++

  const vehicleFields2 = [
    { label: 'الموديل', labelEn: 'Model', col: 'A' },
    { label: 'قراءة العداد عند الدخول', labelEn: 'Entry Odometer', col: 'C' },
    { label: 'قراءة العداد عند الخروج', labelEn: 'Exit Odometer', col: 'E' },
  ]

  vehicleFields2.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow += 2

  // Works Performed
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const worksHeader = worksheet.getCell(`A${currentRow}`)
  worksHeader.value = language === 'ar' ? 'الأعمال المنجزة' : 'Works Performed'
  worksHeader.fill = SECTION_FILL
  worksHeader.font = SECTION_FONT
  worksHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(worksHeader)
  currentRow++

  for (let i = 0; i < 8; i++) {
    const workRow = worksheet.getRow(currentRow)
    workRow.getCell(1).value = `${i + 1}.`
    workRow.getCell(1).font = LABEL_FONT
    workRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(workRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const workCell = workRow.getCell(2)
    workCell.value = ''
    workCell.font = VALUE_FONT
    workCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(workCell)
    currentRow++
  }

  currentRow++

  // Spare Parts
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const partsHeader = worksheet.getCell(`A${currentRow}`)
  partsHeader.value = language === 'ar' ? 'قطع الغيار المستخدمة' : 'Spare Parts Used'
  partsHeader.fill = SECTION_FILL
  partsHeader.font = SECTION_FONT
  partsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(partsHeader)
  currentRow++

  const partsTableHeader = worksheet.getRow(currentRow)
  partsTableHeader.getCell(1).value = language === 'ar' ? 'م' : '#'
  partsTableHeader.getCell(1).font = LABEL_FONT
  partsTableHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
  partsTableHeader.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(partsTableHeader.getCell(1))

  worksheet.mergeCells(`B${currentRow}:E${currentRow}`)
  partsTableHeader.getCell(2).value = language === 'ar' ? 'اسم القطعة' : 'Part Name'
  partsTableHeader.getCell(2).font = LABEL_FONT
  partsTableHeader.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
  partsTableHeader.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(partsTableHeader.getCell(2))

  partsTableHeader.getCell(6).value = language === 'ar' ? 'الكمية' : 'Quantity'
  partsTableHeader.getCell(6).font = LABEL_FONT
  partsTableHeader.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
  partsTableHeader.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(partsTableHeader.getCell(6))
  currentRow++

  for (let i = 0; i < 6; i++) {
    const partRow = worksheet.getRow(currentRow)
    partRow.getCell(1).value = i + 1
    partRow.getCell(1).font = VALUE_FONT
    partRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(partRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:E${currentRow}`)
    const partCell = partRow.getCell(2)
    partCell.value = ''
    partCell.font = VALUE_FONT
    partCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(partCell)

    partRow.getCell(6).value = ''
    partRow.getCell(6).font = VALUE_FONT
    partRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(partRow.getCell(6))
    currentRow++
  }

  currentRow += 2

  // Signatures
  const sigRow = worksheet.getRow(currentRow)
  sigRow.getCell(1).value = language === 'ar' ? 'توقيع الفني:' : 'Technician Signature:'
  sigRow.getCell(1).font = LABEL_FONT
  addBorders(sigRow.getCell(1))
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`)
  addBorders(sigRow.getCell(2))

  sigRow.getCell(4).value = language === 'ar' ? 'توقيع المستلم:' : 'Receiver Signature:'
  sigRow.getCell(4).font = LABEL_FONT
  addBorders(sigRow.getCell(4))
  worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
  addBorders(sigRow.getCell(5))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Preventive Inspection Form (استمارة الفحص الوقائي)
// ═══════════════════════════════════════════════════════════════════════════

export async function generatePreventiveInspectionExcel(language: 'ar' | 'en' = 'ar') {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(language === 'ar' ? 'الفحص الوقائي' : 'Preventive Inspection', {
    properties: { defaultRowHeight: 20 },
    views: [{ rightToLeft: language === 'ar' }],
  })

  worksheet.columns = [
    { width: 30 }, { width: 15 }, { width: 30 }, { width: 15 }, { width: 30 }, { width: 15 },
  ]

  await addHeader(worksheet, 'استمارة الفحص الوقائي للمركبات', 'Vehicle Preventive Inspection Form', workbook)

  let currentRow = 4

  // Vehicle Info
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const sectionCell1 = worksheet.getCell(`A${currentRow}`)
  sectionCell1.value = language === 'ar' ? 'بيانات المركبة' : 'Vehicle Information'
  sectionCell1.fill = SECTION_FILL
  sectionCell1.font = SECTION_FONT
  sectionCell1.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(sectionCell1)
  currentRow++

  const infoFields = [
    { label: 'رقم اللوحة', labelEn: 'Plate Number', col: 'A' },
    { label: 'اسم السائق', labelEn: 'Driver Name', col: 'C' },
    { label: 'المحمية', labelEn: 'Reserve', col: 'E' },
  ]

  infoFields.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow++

  const infoFields2 = [
    { label: 'تاريخ الفحص', labelEn: 'Inspection Date', col: 'A' },
    { label: 'قراءة العداد', labelEn: 'Current Odometer', col: 'C' },
  ]

  infoFields2.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow += 2

  // Fluid Levels
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const fluidsHeader = worksheet.getCell(`A${currentRow}`)
  fluidsHeader.value = language === 'ar' ? 'مستويات السوائل' : 'Fluid Levels'
  fluidsHeader.fill = SECTION_FILL
  fluidsHeader.font = SECTION_FONT
  fluidsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(fluidsHeader)
  currentRow++

  const fluidChecks = [
    { label: 'مستوى زيت المحرك', labelEn: 'Engine Oil Level', col: 'A' },
    { label: 'مستوى ماء الرديتر', labelEn: 'Radiator Water Level', col: 'C' },
    { label: 'مستوى زيت الفرامل', labelEn: 'Brake Oil Level', col: 'E' },
  ]

  fluidChecks.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = language === 'ar' ? '☐ جيد  ☐ متوسط  ☐ منخفض' : '☐ Good  ☐ Medium  ☐ Low'
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow += 2

  // Tires & Brakes
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const tiresHeader = worksheet.getCell(`A${currentRow}`)
  tiresHeader.value = language === 'ar' ? 'الإطارات والفرامل' : 'Tires & Brakes'
  tiresHeader.fill = SECTION_FILL
  tiresHeader.font = SECTION_FONT
  tiresHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(tiresHeader)
  currentRow++

  const tireChecks = [
    { label: 'ضغط الإطارات', labelEn: 'Tire Pressure' },
    { label: 'حالة الإطارات', labelEn: 'Tire Condition' },
    { label: 'حالة الفرامل', labelEn: 'Brake Condition' },
  ]

  tireChecks.forEach(check => {
    const checkRow = worksheet.getRow(currentRow)
    checkRow.getCell(1).value = language === 'ar' ? check.label : check.labelEn
    checkRow.getCell(1).font = LABEL_FONT
    checkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    checkRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(checkRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const valueCell = checkRow.getCell(2)
    valueCell.value = language === 'ar' ? '☐ جيد  ☐ متوسط  ☐ غير جيد' : '☐ Good  ☐ Moderate  ☐ Not Good'
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
    currentRow++
  })

  currentRow++

  // Lights & Electrical
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const lightsHeader = worksheet.getCell(`A${currentRow}`)
  lightsHeader.value = language === 'ar' ? 'الإضاءة والكهرباء' : 'Lights & Electrical'
  lightsHeader.fill = SECTION_FILL
  lightsHeader.font = SECTION_FONT
  lightsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(lightsHeader)
  currentRow++

  const lightChecks = [
    { label: 'الأنوار الأمامية', labelEn: 'Front Lights' },
    { label: 'الأنوار الخلفية', labelEn: 'Rear Lights' },
    { label: 'الإشارات', labelEn: 'Turn Signals' },
    { label: 'لمبات التحذير بالطبلون', labelEn: 'Dashboard Warning Lights' },
  ]

  lightChecks.forEach(check => {
    const checkRow = worksheet.getRow(currentRow)
    checkRow.getCell(1).value = language === 'ar' ? check.label : check.labelEn
    checkRow.getCell(1).font = LABEL_FONT
    checkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    checkRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(checkRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const valueCell = checkRow.getCell(2)
    valueCell.value = language === 'ar' ? '☐ سليم  ☐ يحتاج صيانة' : '☐ OK  ☐ Needs Maintenance'
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
    currentRow++
  })

  currentRow++

  // Mechanical Checks
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const mechHeader = worksheet.getCell(`A${currentRow}`)
  mechHeader.value = language === 'ar' ? 'الفحوصات الميكانيكية' : 'Mechanical Checks'
  mechHeader.fill = SECTION_FILL
  mechHeader.font = SECTION_FONT
  mechHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(mechHeader)
  currentRow++

  const mechChecks = [
    { label: 'صوت المحرك', labelEn: 'Engine Sound' },
    { label: 'المقود', labelEn: 'Steering' },
    { label: 'أسفل المركبة', labelEn: 'Underbody' },
  ]

  mechChecks.forEach(check => {
    const checkRow = worksheet.getRow(currentRow)
    checkRow.getCell(1).value = language === 'ar' ? check.label : check.labelEn
    checkRow.getCell(1).font = LABEL_FONT
    checkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    checkRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(checkRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const valueCell = checkRow.getCell(2)
    valueCell.value = language === 'ar' ? '☐ سليم  ☐ يحتاج صيانة' : '☐ OK  ☐ Needs Maintenance'
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
    currentRow++
  })

  currentRow++

  // Safety & Equipment
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const safetyHeader = worksheet.getCell(`A${currentRow}`)
  safetyHeader.value = language === 'ar' ? 'السلامة والمعدات' : 'Safety & Equipment'
  safetyHeader.fill = SECTION_FILL
  safetyHeader.font = SECTION_FONT
  safetyHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(safetyHeader)
  currentRow++

  const safetyChecks = [
    { label: 'معدات السلامة', labelEn: 'Safety Equipment' },
    { label: 'الإطار الاحتياطي', labelEn: 'Spare Tire' },
    { label: 'العدد', labelEn: 'Tools' },
    { label: 'نظافة الداخل', labelEn: 'Interior Cleanliness' },
    { label: 'نظافة الخارج', labelEn: 'Exterior Cleanliness' },
  ]

  safetyChecks.forEach(check => {
    const checkRow = worksheet.getRow(currentRow)
    checkRow.getCell(1).value = language === 'ar' ? check.label : check.labelEn
    checkRow.getCell(1).font = LABEL_FONT
    checkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    checkRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(checkRow.getCell(1))

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`)
    const valueCell = checkRow.getCell(2)
    valueCell.value = language === 'ar' ? '☐ متوفر  ☐ غير متوفر' : '☐ Available  ☐ Not Available'
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
    currentRow++
  })

  currentRow += 2

  // Signatures
  const sigRow = worksheet.getRow(currentRow)
  sigRow.getCell(1).value = language === 'ar' ? 'توقيع الفاحص:' : 'Inspector Signature:'
  sigRow.getCell(1).font = LABEL_FONT
  addBorders(sigRow.getCell(1))
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`)
  addBorders(sigRow.getCell(2))

  sigRow.getCell(4).value = language === 'ar' ? 'توقيع السائق:' : 'Driver Signature:'
  sigRow.getCell(4).font = LABEL_FONT
  addBorders(sigRow.getCell(4))
  worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
  addBorders(sigRow.getCell(5))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Mobile Maintenance Inventory Form (استمارة جرد الصيانة المتنقلة)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMobileMaintenanceInventoryExcel(language: 'ar' | 'en' = 'ar') {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(language === 'ar' ? 'جرد الصيانة المتنقلة' : 'Mobile Maintenance Inventory', {
    properties: { defaultRowHeight: 20 },
    views: [{ rightToLeft: language === 'ar' }],
  })

  worksheet.columns = [
    { width: 8 }, { width: 35 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 25 },
  ]

  await addHeader(worksheet, 'استمارة جرد مركبة الصيانة المتنقلة', 'Mobile Maintenance Vehicle Inventory Form', workbook)

  let currentRow = 4

  // Header Info
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const infoSection = worksheet.getCell(`A${currentRow}`)
  infoSection.value = language === 'ar' ? 'بيانات الجرد' : 'Inventory Information'
  infoSection.fill = SECTION_FILL
  infoSection.font = SECTION_FONT
  infoSection.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(infoSection)
  currentRow++

  const infoFields = [
    { label: 'رقم لوحة المركبة', labelEn: 'Vehicle Plate Number', col: 'A' },
    { label: 'التاريخ', labelEn: 'Date', col: 'C' },
    { label: 'نوع الجرد', labelEn: 'Inventory Type', col: 'E' },
  ]

  infoFields.forEach(field => {
    const labelCell = worksheet.getCell(`${field.col}${currentRow}`)
    labelCell.value = language === 'ar' ? field.label : field.labelEn
    labelCell.font = LABEL_FONT
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(labelCell)

    const valueCell = worksheet.getCell(`${String.fromCharCode(field.col.charCodeAt(0) + 1)}${currentRow}`)
    valueCell.value = ''
    valueCell.font = VALUE_FONT
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    addBorders(valueCell)
  })
  currentRow++

  const typeRow = worksheet.getRow(currentRow)
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const typeCell = typeRow.getCell(1)
  typeCell.value = language === 'ar' 
    ? '☐ يومي  ☐ أسبوعي  ☐ شهري  ☐ مفاجئ' 
    : '☐ Daily  ☐ Weekly  ☐ Monthly  ☐ Surprise'
  typeCell.font = VALUE_FONT
  typeCell.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(typeCell)
  currentRow += 2

  // Inventory Table
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
  const tableHeader = worksheet.getCell(`A${currentRow}`)
  tableHeader.value = language === 'ar' ? 'جدول الجرد' : 'Inventory Table'
  tableHeader.fill = SECTION_FILL
  tableHeader.font = SECTION_FONT
  tableHeader.alignment = { horizontal: 'center', vertical: 'middle' }
  addBorders(tableHeader)
  currentRow++

  // Table Headers
  const headers = worksheet.getRow(currentRow)
  const headerLabels = [
    { col: 1, label: 'م', labelEn: '#' },
    { col: 2, label: 'الصنف', labelEn: 'Item' },
    { col: 3, label: 'الكمية المطلوبة', labelEn: 'Required Qty' },
    { col: 4, label: 'الكمية الفعلية', labelEn: 'Actual Qty' },
    { col: 5, label: 'الحالة', labelEn: 'Condition' },
    { col: 6, label: 'ملاحظات', labelEn: 'Notes' },
  ]

  headerLabels.forEach(h => {
    const cell = headers.getCell(h.col)
    cell.value = language === 'ar' ? h.label : h.labelEn
    cell.font = LABEL_FONT
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(cell)
  })
  currentRow++

  // Inventory Items
  const inventoryItems = [
    { ar: 'مفاتيح ربط (مقاسات مختلفة)', en: 'Wrenches (various sizes)' },
    { ar: 'مفكات (عادي وصليبة)', en: 'Screwdrivers (flat & Phillips)' },
    { ar: 'كماشة', en: 'Pliers' },
    { ar: 'مطرقة', en: 'Hammer' },
    { ar: 'جاك هيدروليكي', en: 'Hydraulic Jack' },
    { ar: 'حامل مركبة (ستاند)', en: 'Vehicle Stand' },
    { ar: 'كشاف إضاءة', en: 'Work Light' },
    { ar: 'جهاز فحص كهربائي', en: 'Electrical Tester' },
    { ar: 'زيت محرك', en: 'Engine Oil' },
    { ar: 'زيت فرامل', en: 'Brake Oil' },
    { ar: 'ماء رديتر', en: 'Radiator Coolant' },
    { ar: 'فلاتر زيت', en: 'Oil Filters' },
    { ar: 'فلاتر هواء', en: 'Air Filters' },
    { ar: 'شمعات احتراق', en: 'Spark Plugs' },
    { ar: 'أسلاك كهربائية', en: 'Electrical Wires' },
    { ar: 'صمولات وبراغي', en: 'Nuts & Bolts' },
    { ar: 'خراطيم', en: 'Hoses' },
    { ar: 'حزام مروحة', en: 'Fan Belt' },
    { ar: 'بطارية احتياطية', en: 'Spare Battery' },
    { ar: 'طفاية حريق', en: 'Fire Extinguisher' },
    { ar: 'مثلث تحذير', en: 'Warning Triangle' },
    { ar: 'حقيبة إسعافات أولية', en: 'First Aid Kit' },
    { ar: 'قفازات عمل', en: 'Work Gloves' },
    { ar: 'قطع قماش', en: 'Rags' },
    { ar: 'مواد تنظيف', en: 'Cleaning Supplies' },
  ]

  inventoryItems.forEach((item, index) => {
    const row = worksheet.getRow(currentRow)
    row.getCell(1).value = index + 1
    row.getCell(1).font = VALUE_FONT
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    addBorders(row.getCell(1))

    row.getCell(2).value = language === 'ar' ? item.ar : item.en
    row.getCell(2).font = VALUE_FONT
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
    addBorders(row.getCell(2))

    for (let col = 3; col <= 6; col++) {
      row.getCell(col).value = ''
      row.getCell(col).font = VALUE_FONT
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
      addBorders(row.getCell(col))
    }
    currentRow++
  })

  currentRow += 2

  // Signatures
  const sigRow = worksheet.getRow(currentRow)
  sigRow.getCell(1).value = language === 'ar' ? 'توقيع المسؤول:' : 'Supervisor Signature:'
  sigRow.getCell(1).font = LABEL_FONT
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
  addBorders(sigRow.getCell(1))
  worksheet.mergeCells(`C${currentRow}:D${currentRow}`)
  addBorders(sigRow.getCell(3))

  sigRow.getCell(5).value = language === 'ar' ? 'التاريخ:' : 'Date:'
  sigRow.getCell(5).font = LABEL_FONT
  addBorders(sigRow.getCell(5))
  addBorders(sigRow.getCell(6))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
