// Notification trigger helpers - call these from client-side after key events

interface NotifyPayload {
  company_id: string
  type: string
  title_ar: string
  title_en: string
  body_ar?: string
  body_en?: string
  reference_id?: string
}

async function sendNotification(payload: NotifyPayload) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Silent fail - notifications are non-critical
  }
}

export function notifyNewJobCard(companyId: string, jobCardNumber: string, plateNumber: string, jobCardId: string) {
  return sendNotification({
    company_id: companyId,
    type: 'new_job_card',
    title_ar: `حالة جديدة #${jobCardNumber}`,
    title_en: `New Case #${jobCardNumber}`,
    body_ar: `تم إنشاء حالة جديدة للمركبة ${plateNumber}`,
    body_en: `New case created for vehicle ${plateNumber}`,
    reference_id: jobCardId,
  })
}

export function notifyJobCardDelivered(companyId: string, jobCardNumber: string, plateNumber: string, jobCardId: string) {
  return sendNotification({
    company_id: companyId,
    type: 'job_card_delivered',
    title_ar: `تم تسليم الحالة #${jobCardNumber}`,
    title_en: `Case #${jobCardNumber} Delivered`,
    body_ar: `تم تسليم المركبة ${plateNumber} بعد الصيانة`,
    body_en: `Vehicle ${plateNumber} has been delivered after maintenance`,
    reference_id: jobCardId,
  })
}

export function notifyVehicleOverdue(companyId: string, plateNumber: string, days: number, jobCardId: string) {
  return sendNotification({
    company_id: companyId,
    type: 'vehicle_overdue',
    title_ar: `مركبة متأخرة: ${plateNumber}`,
    title_en: `Vehicle Overdue: ${plateNumber}`,
    body_ar: `المركبة ${plateNumber} في الصيانة منذ ${days} يوم`,
    body_en: `Vehicle ${plateNumber} has been in maintenance for ${days} days`,
    reference_id: jobCardId,
  })
}

export function notifyLowStock(companyId: string, partNameAr: string, partNameEn: string, currentQty: number, minLevel: number, partId: string) {
  return sendNotification({
    company_id: companyId,
    type: 'low_stock',
    title_ar: `مخزون منخفض: ${partNameAr}`,
    title_en: `Low Stock: ${partNameEn}`,
    body_ar: `الكمية الحالية (${currentQty}) أقل من الحد الأدنى (${minLevel})`,
    body_en: `Current quantity (${currentQty}) is below minimum level (${minLevel})`,
    reference_id: partId,
  })
}

export function notifyVehicleReceived(companyId: string, plateNumber: string, jobCardNumber: string, jobCardId: string) {
  return sendNotification({
    company_id: companyId,
    type: 'vehicle_received',
    title_ar: `استلام مركبة: ${plateNumber}`,
    title_en: `Vehicle Received: ${plateNumber}`,
    body_ar: `تم استلام المركبة ${plateNumber} - حالة #${jobCardNumber}`,
    body_en: `Vehicle ${plateNumber} received - Case #${jobCardNumber}`,
    reference_id: jobCardId,
  })
}
