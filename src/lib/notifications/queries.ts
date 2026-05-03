// =====================================================
// Notification queries and utilities
// =====================================================

import { createClient } from '@/lib/supabase/client'
import type { Notification, NotificationType } from './types'

/**
 * Create a new notification
 */
export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  caseId?: string
  expiresAt?: Date
}): Promise<Notification | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      case_id: params.caseId || null,
      expires_at: params.expiresAt?.toISOString() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[notifications] createNotification failed:', error)
    return null
  }

  return data as Notification
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[notifications] getUnreadNotifications failed:', error)
    return []
  }

  return (data as Notification[]) || []
}

/**
 * Get all notifications for a user
 */
export async function getAllNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[notifications] getAllNotifications failed:', error)
    return []
  }

  return (data as Notification[]) || []
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('[notifications] markNotificationAsRead failed:', error)
    return false
  }

  return true
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('[notifications] markAllAsRead failed:', error)
    return false
  }

  return true
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) {
    console.error('[notifications] deleteNotification failed:', error)
    return false
  }

  return true
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('[notifications] cleanupExpiredNotifications failed:', error)
  }
}
