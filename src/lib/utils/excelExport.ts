import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

interface ExcelColumn {
  header: string
  key: string
  width?: number
}

interface ExcelSheetData {
  sheetName: string
  title?: string
  subtitle?: string
  columns: ExcelColumn[]
  rows: Record<string, any>[]
  noSummary?: boolean
}

const BRAND_RED = 'B91C1C'
const HEADER_BG = 'B91C1C'
const HEADER_FONT = 'FFFFFF'
const ALT_ROW_BG = 'FEF2F2'
const BORDER_COLOR = 'FECACA'
const TITLE_BG = '991B1B'
const SUBTITLE_BG = 'FEE2E2'

// الأوائل → logo.png (يسار) + logo.png (يمين)
// غيرها (التمليك, لومي, ...) → logo.png فقط
function isAwaelCompany(name?: string): boolean {
  if (!name) return false
  return /أوائل|awael|pioneer/i.test(name)
}

async function loadLogosAsBase64(
  companyNameAr?: string
): Promise<{ logo1: string | null; logo2: string | null }> {
  try {
    const showBothLogos = isAwaelCompany(companyNameAr)
    const [res2, res1] = await Promise.all([
      fetch('/images/logo.png'),
      showBothLogos ? fetch('/images/logo.png') : Promise.resolve(null),
    ])
    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf)
      let binary = ''
      bytes.forEach((b) => (binary += String.fromCharCode(b)))
      return btoa(binary)
    }
    const buf2 = await res2.arrayBuffer()
    const logo2 = toBase64(buf2)
    let logo1: string | null = null
    if (res1) {
      const buf1 = await res1.arrayBuffer()
      logo1 = toBase64(buf1)
    }
    return { logo1, logo2 }
  } catch {
    return { logo1: null, logo2: null }
  }
}

function applyHeaderStyle(row: ExcelJS.Row, colCount: number) {
  row.height = 28
  row.eachCell((cell, colNumber) => {
    if (colNumber <= colCount) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11, name: 'Cairo' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'medium', color: { argb: BRAND_RED } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      }
    }
  })
}

function applyDataRowStyle(row: ExcelJS.Row, colCount: number, isAlt: boolean) {
  row.height = 22
  row.eachCell((cell, colNumber) => {
    if (colNumber <= colCount) {
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_BG } }
      }
      cell.font = { size: 10, name: 'Cairo' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      }
    }
  })
}

function applySummaryStyle(row: ExcelJS.Row, colCount: number) {
  row.height = 26
  row.eachCell((cell, colNumber) => {
    if (colNumber <= colCount) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
      cell.font = { bold: true, size: 11, name: 'Cairo', color: { argb: BRAND_RED } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'medium', color: { argb: BRAND_RED } },
        bottom: { style: 'medium', color: { argb: BRAND_RED } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      }
    }
  })
}

async function addLogosAndHeader(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  title: string,
  subtitle: string,
  colCount: number,
  logos: { logo1: string | null; logo2: string | null }
): Promise<number> {
  let startRow = 1

  // Row 1: Logos row (height 60)
  ws.getRow(1).height = 60
  ws.mergeCells(1, 1, 1, colCount)
  const logoCell = ws.getCell(1, 1)
  logoCell.value = ''

  if (logos.logo1) {
    const img1 = wb.addImage({ base64: logos.logo1, extension: 'png' })
    ws.addImage(img1, {
      tl: { col: 0.2, row: 0.1 },
      ext: { width: 55, height: 55 },
    })
  }
  if (logos.logo2) {
    const img2 = wb.addImage({ base64: logos.logo2, extension: 'png' })
    ws.addImage(img2, {
      tl: { col: Math.max(colCount - 1.5, 1), row: 0.1 },
      ext: { width: 55, height: 55 },
    })
  }
  startRow = 2

  // Row 2: Title
  ws.getRow(startRow).height = 32
  ws.mergeCells(startRow, 1, startRow, colCount)
  const titleCell = ws.getCell(startRow, 1)
  titleCell.value = title
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BG } }
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' }, name: 'Cairo' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  startRow++

  // Row 3: Subtitle
  if (subtitle) {
    ws.getRow(startRow).height = 24
    ws.mergeCells(startRow, 1, startRow, colCount)
    const subCell = ws.getCell(startRow, 1)
    subCell.value = subtitle
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTITLE_BG } }
    subCell.font = { size: 10, color: { argb: '555555' }, name: 'Cairo', italic: true }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    startRow++
  }

  // Empty spacer row
  ws.getRow(startRow).height = 8
  startRow++

  return startRow
}

/**
 * Generate and download a professionally formatted Excel file
 * with dual logos (for الأوائل) or single logo (for other companies),
 * modern styling, and multiple sheets
 */
export async function exportDashboardExcel(
  sheets: ExcelSheetData[],
  fileName: string,
  companyNameAr?: string   // ← اسم الشركة لتحديد اللوجو
) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'VMS'
  wb.created = new Date()

  const logos = await loadLogosAsBase64(companyNameAr)

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.sheetName.substring(0, 31), {
      views: [{ rightToLeft: true }],
    })

    const colCount = sheet.columns.length

    // Set column widths
    ws.columns = sheet.columns.map((col) => ({
      width: col.width || Math.max(col.header.length + 4, 16),
    }))

    // Add logos + title
    const dataStartRow = await addLogosAndHeader(
      ws, wb,
      sheet.title || sheet.sheetName,
      sheet.subtitle || new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }),
      colCount,
      logos
    )

    // Header row
    const headerRow = ws.getRow(dataStartRow)
    sheet.columns.forEach((col, i) => {
      headerRow.getCell(i + 1).value = col.header
    })
    applyHeaderStyle(headerRow, colCount)

    // Data rows
    sheet.rows.forEach((row, rowIdx) => {
      const excelRow = ws.getRow(dataStartRow + 1 + rowIdx)
      sheet.columns.forEach((col, colIdx) => {
        excelRow.getCell(colIdx + 1).value = row[col.key] ?? ''
      })
      applyDataRowStyle(excelRow, colCount, rowIdx % 2 === 1)
    })

    // Summary row (skip if noSummary is set)
    if (sheet.rows.length > 0 && !sheet.noSummary) {
      const summaryRowNum = dataStartRow + 1 + sheet.rows.length + 1
      const summaryRow = ws.getRow(summaryRowNum)
      let hasSummary = false

      sheet.columns.forEach((col, i) => {
        if (i === 0) {
          summaryRow.getCell(1).value = 'الإجمالي / Total'
        } else {
          const values = sheet.rows.map((r) => r[col.key])
          if (values.every((v) => typeof v === 'number')) {
            summaryRow.getCell(i + 1).value = values.reduce((a: number, b: number) => a + b, 0)
            hasSummary = true
          }
        }
      })

      if (hasSummary) {
        applySummaryStyle(summaryRow, colCount)
      }
    }

    // Footer
    const footerRow = dataStartRow + sheet.rows.length + 4
    ws.mergeCells(footerRow, 1, footerRow, colCount)
    const footerCell = ws.getCell(footerRow, 1)
    footerCell.value = `VMS — ${new Date().toLocaleDateString('ar-SA')}`
    footerCell.font = { size: 8, color: { argb: '999999' }, name: 'Cairo', italic: true }
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().split('T')[0]
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileName}_${date}.xlsx`)
}

/**
 * Quick single-sheet export
 */
export async function exportSingleSheet(
  title: string,
  columns: ExcelColumn[],
  rows: Record<string, any>[],
  fileName: string,
  options?: { noSummary?: boolean },
  companyNameAr?: string   // ← اسم الشركة لتحديد اللوجو
) {
  await exportDashboardExcel(
    [{ sheetName: title.substring(0, 31), title, columns, rows, noSummary: options?.noSummary }],
    fileName,
    companyNameAr
  )
}
