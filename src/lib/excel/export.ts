/**
 * Excel Export Utility
 * Provides styled Excel export functionality for VMS data
 */

import * as XLSX from 'xlsx'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
  style?: {
    font?: { bold?: boolean; color?: { rgb: string } }
    fill?: { fgColor?: { rgb: string } }
    alignment?: { horizontal?: string }
  }
}

export interface ExcelSheet {
  name: string
  columns: ExcelColumn[]
  data: any[]
}

/**
 * Export data to Excel with styling
 */
export function exportToExcel(sheets: ExcelSheet[], filename: string) {
  const workbook = XLSX.utils.book_new()

  sheets.forEach(sheet => {
    // Create worksheet with headers
    const headers = sheet.columns.map(col => col.header)
    const keys = sheet.columns.map(col => col.key)

    // Create data rows
    const rows = sheet.data.map(row =>
      keys.map(key => {
        const value = row[key]
        // Handle null/undefined
        if (value === null || value === undefined) return ''
        // Handle numbers
        if (typeof value === 'number') return value
        // Handle dates
        if (value instanceof Date) return value.toLocaleDateString('ar-SA')
        return String(value)
      })
    )

    // Combine headers and data
    const worksheetData = [headers, ...rows]

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Set column widths
    const colWidths = sheet.columns.map(col => ({ wch: col.width || 15 }))
    worksheet['!cols'] = colWidths

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  // Generate and download
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Invoice-specific Excel export
 */
export function exportInvoicesToExcel(invoices: any[], items: Record<string, any[]>) {
  // Main sheet: Invoice summary
  const summarySheet: ExcelSheet = {
    name: 'الفواتير',
    columns: [
      { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
      { header: 'التاريخ', key: 'invoice_date', width: 12 },
      { header: 'اللوحة', key: 'vehicle_plate', width: 12 },
      { header: 'المركبة', key: 'vehicle_label', width: 20 },
      { header: 'الورشة', key: 'workshop_name', width: 20 },
      { header: 'نوع الإصلاح', key: 'repair_type', width: 15 },
      { header: 'الإجمالي', key: 'total', width: 12 },
      { header: 'الحالة', key: 'status', width: 12 },
    ],
    data: invoices,
  }

  // Details sheet: Invoice items
  const allItems: any[] = []
  invoices.forEach(inv => {
    const invItems = items[inv.id] || []
    invItems.forEach((item: any) => {
      allItems.push({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        vehicle_plate: inv.vehicle_plate,
        item_name: item.item_name || item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
      })
    })
  })

  const detailsSheet: ExcelSheet = {
    name: 'تفاصيل البنود',
    columns: [
      { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
      { header: 'التاريخ', key: 'invoice_date', width: 12 },
      { header: 'اللوحة', key: 'vehicle_plate', width: 12 },
      { header: 'البند', key: 'item_name', width: 25 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر الوحدة', key: 'unit_price', width: 12 },
      { header: 'الإجمالي', key: 'total', width: 12 },
    ],
    data: allItems,
  }

  exportToExcel([summarySheet, detailsSheet], 'فواتير_الصيانة')
}

/**
 * Misuse report-specific Excel export
 */
export function exportMisuseToExcel(registrations: any[], laborItems: Record<string, any[]>, sparePartItems: Record<string, any[]>) {
  // Main sheet: Registration summary
  const summarySheet: ExcelSheet = {
    name: 'سجلات سوء الاستخدام',
    columns: [
      { header: 'رقم السجل', key: 'registration_number', width: 15 },
      { header: 'التاريخ', key: 'registration_date', width: 12 },
      { header: 'المشروع', key: 'project_name', width: 20 },
      { header: 'اللوحة', key: 'plate_number', width: 12 },
      { header: 'نوع المركبة', key: 'vehicle_type', width: 15 },
      { header: 'السائق', key: 'driver_name', width: 20 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'الإجمالي', key: 'total', width: 12 },
    ],
    data: registrations,
  }

  // Labor items sheet
  const allLabor: any[] = []
  registrations.forEach(reg => {
    const items = laborItems[reg.id] || []
    items.forEach((item: any) => {
      allLabor.push({
        registration_number: reg.registration_number,
        registration_date: reg.registration_date,
        plate_number: reg.plate_number,
        item_name: item.item_name || item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
      })
    })
  })

  const laborSheet: ExcelSheet = {
    name: 'أعمال الصيانة',
    columns: [
      { header: 'رقم السجل', key: 'registration_number', width: 15 },
      { header: 'التاريخ', key: 'registration_date', width: 12 },
      { header: 'اللوحة', key: 'plate_number', width: 12 },
      { header: 'البند', key: 'item_name', width: 25 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر الوحدة', key: 'unit_price', width: 12 },
      { header: 'الإجمالي', key: 'total', width: 12 },
    ],
    data: allLabor,
  }

  // Spare parts sheet
  const allParts: any[] = []
  registrations.forEach(reg => {
    const items = sparePartItems[reg.id] || []
    items.forEach((item: any) => {
      allParts.push({
        registration_number: reg.registration_number,
        registration_date: reg.registration_date,
        plate_number: reg.plate_number,
        item_name: item.item_name || item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
      })
    })
  })

  const partsSheet: ExcelSheet = {
    name: 'قطع الغيار',
    columns: [
      { header: 'رقم السجل', key: 'registration_number', width: 15 },
      { header: 'التاريخ', key: 'registration_date', width: 12 },
      { header: 'اللوحة', key: 'plate_number', width: 12 },
      { header: 'القطعة', key: 'item_name', width: 25 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر الوحدة', key: 'unit_price', width: 12 },
      { header: 'الإجمالي', key: 'total', width: 12 },
    ],
    data: allParts,
  }

  exportToExcel([summarySheet, laborSheet, partsSheet], 'سجلات_سوء_الاستخدام')
}
