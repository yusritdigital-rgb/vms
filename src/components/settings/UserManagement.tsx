'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Mail, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

interface User {
  id: string
  email: string
  role: 'admin' | 'manager' | 'user'
  created_at: string
  last_sign_in_at: string | null
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' as User['role'] })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_users')

      if (error) throw error

      setUsers((data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        role: u.role as User['role'],
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })))
    } catch (err: any) {
      console.error('Error loading users:', err)
      setError(err.message || 'فشل في تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    setError('')
    setSuccess('')

    if (!newUser.email || !newUser.password) {
      setError('يرجى ملء جميع الحقول')
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('create_user', {
        p_email: newUser.email,
        p_password: newUser.password,
        p_role: newUser.role,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error)

      setSuccess('تم إضافة المستخدم بنجاح')
      setShowAddDialog(false)
      setNewUser({ email: '', password: '', role: 'user' })
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'فشل في إضافة المستخدم')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('delete_user', {
        p_user_id: selectedUser.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error)

      setSuccess('تم حذف المستخدم بنجاح')
      setShowDeleteDialog(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'فشل في حذف المستخدم')
    }
  }

  const getRoleBadge = (role: User['role']) => {
    const styles = {
      admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      manager: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      user: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    }

    const labels = {
      admin: 'مدير',
      manager: 'مشرف',
      user: 'مستخدم',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[role]}`}>
        {labels[role]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            المستخدمين ({users.length})
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            إدارة حسابات المستخدمين وصلاحياتهم
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة مستخدم
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{success}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                البريد الإلكتروني
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                الصلاحية
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                آخر تسجيل دخول
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.email}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {getRoleBadge(user.role)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString('ar-SA')
                    : 'لم يسجل دخول'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowDeleteDialog(true)
                    }}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                إضافة مستخدم جديد
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الصلاحية
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="user">مستخدم</option>
                  <option value="manager">مشرف</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowAddDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddUser}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="حذف مستخدم"
        message={`هل أنت متأكد من حذف المستخدم ${selectedUser?.email}؟`}
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDeleteUser}
        onCancel={() => {
          setShowDeleteDialog(false)
          setSelectedUser(null)
        }}
        variant="danger"
      />
    </div>
  )
}
