// =====================================================
// Notification types and utilities
// =====================================================

export type NotificationType = 'case_ready' | 'case_delivered' | 'case_overdue' | 'workshop_transfer' | 'other'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  case_id: string | null
  is_read: boolean
  created_at: string
  expires_at: string | null
}

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  case_ready: 'سيارة جاهزة',
  case_delivered: 'تم التسليم',
  case_overdue: 'تأخير سيارة',
  workshop_transfer: 'نقل ورشة',
  other: 'إشعار عام',
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  case_ready: 'CheckCircle',
  case_delivered: 'CheckCircle',
  case_overdue: 'AlertTriangle',
  workshop_transfer: 'ArrowRightLeft',
  other: 'Bell',
}
