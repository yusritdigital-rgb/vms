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
 * Import data from Excel file
 */
export async function importFromExcel(file: File): Promise<{ [sheetName: string]: any[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const result: { [sheetName: string]: any[] } = {}

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[]
            const rows = jsonData.slice(1).map((row: any) => {
              const obj: any = {}
              headers.forEach((header, index) => {
                obj[header] = row[index] || ''
              })
              return obj
            })
            result[sheetName] = rows
          }
        })

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
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
      { header: 'المشروع', key: 'project', width: 15 },
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
      const lineTotal = (item.quantity || 1) * (item.unit_price || 0)
      allItems.push({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        project: inv.project || '',
        vehicle_plate: inv.vehicle_plate,
        item_type: item.item_type || '',
        description: item.description || '',
        value: lineTotal.toLocaleString('en-US'),
      })
    })
  })

  const detailsSheet: ExcelSheet = {
    name: 'تفاصيل البنود',
    columns: [
      { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
      { header: 'التاريخ', key: 'invoice_date', width: 12 },
      { header: 'المشروع', key: 'project', width: 15 },
      { header: 'اللوحة', key: 'vehicle_plate', width: 12 },
      { header: 'نوع البند', key: 'item_type', width: 12 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'القيمة', key: 'value', width: 12 },
    ],
    data: allItems,
  }

  exportToExcel([summarySheet, detailsSheet], 'فواتير_الصيانة')
}

/**
 * Misuse report-specific Excel export
 * Format matches invoices export with combined items sheet and full styling
 */
export async function exportMisuseToExcel(registrations: any[], laborItems: Record<string, any[]>, sparePartItems: Record<string, any[]>) {
  const { exportDashboardExcel } = await import('@/lib/utils/excelExport')
  
  // Main sheet: Registration summary
  const summarySheet = {
    sheetName: 'سجلات سوء الاستخدام',
    title: 'سجلات سوء الاستخدام',
    subtitle: 'نموذج سوء الاستخدام / تحميل تكلفة الإصلاح',
    columns: [
      { header: 'رقم السجل', key: 'registration_number', width: 15 },
      { header: 'التاريخ', key: 'registration_date', width: 12 },
      { header: 'المشروع', key: 'project_name', width: 20 },
      { header: 'اللوحة', key: 'plate_number', width: 12 },
      { header: 'نوع المركبة', key: 'vehicle_type', width: 15 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'الإجمالي', key: 'total', width: 12 },
    ],
    rows: registrations,
  }

  // Combined items sheet (labor + parts) - same format as invoices
  const allItems: any[] = []
  registrations.forEach(reg => {
    const labor = laborItems[reg.id] || []
    const parts = sparePartItems[reg.id] || []
    
    // Add labor items
    labor.forEach((item: any) => {
      allItems.push({
        registration_number: reg.registration_number,
        registration_date: reg.registration_date,
        project: reg.project_name || '',
        plate_number: reg.plate_number,
        item_type: 'أعمال الصيانة',
        description: item.item_name || item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        line_total: (item.quantity || 1) * (item.unit_price || 0),
      })
    })
    
    // Add spare part items
    parts.forEach((item: any) => {
      allItems.push({
        registration_number: reg.registration_number,
        registration_date: reg.registration_date,
        project: reg.project_name || '',
        plate_number: reg.plate_number,
        item_type: 'قطع الغيار',
        description: item.item_name || item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        line_total: (item.quantity || 1) * (item.unit_price || 0),
      })
    })
  })

  const detailsSheet = {
    sheetName: 'تفاصيل البنود',
    title: 'تفاصيل البنود',
    subtitle: 'أعمال الصيانة وقطع الغيار',
    columns: [
      { header: 'رقم السجل', key: 'registration_number', width: 15 },
      { header: 'التاريخ', key: 'registration_date', width: 12 },
      { header: 'المشروع', key: 'project', width: 15 },
      { header: 'اللوحة', key: 'plate_number', width: 12 },
      { header: 'نوع البند', key: 'item_type', width: 12 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر الوحدة', key: 'unit_price', width: 12 },
      { header: 'الإجمالي', key: 'line_total', width: 12 },
    ],
    rows: allItems,
  }

  await exportDashboardExcel([summarySheet, detailsSheet], 'سجلات_سوء_الاستخدام', 'شركة الأوائل')
}
