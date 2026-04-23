'use client'

import { Shield, CheckCircle, XCircle } from 'lucide-react'

const permissions = [
  {
    module: 'Dashboard',
    permissions: [
      { id: 'dashboard.view', label: 'عرض لوحة التحكم', admin: true, manager: true, user: true },
      { id: 'dashboard.export', label: 'تصدير البيانات', admin: true, manager: true, user: false },
    ],
  },
  {
    module: 'Fleet',
    permissions: [
      { id: 'fleet.view', label: 'عرض الأسطول', admin: true, manager: true, user: true },
      { id: 'fleet.add', label: 'إضافة مركبة', admin: true, manager: true, user: false },
      { id: 'fleet.edit', label: 'تعديل مركبة', admin: true, manager: true, user: false },
      { id: 'fleet.delete', label: 'حذف مركبة', admin: true, manager: false, user: false },
      { id: 'fleet.bulk_upload', label: 'رفع ملف CSV', admin: true, manager: false, user: false },
    ],
  },
  {
    module: 'Job Cards',
    permissions: [
      { id: 'jobcards.view', label: 'عرض كروت العمل', admin: true, manager: true, user: true },
      { id: 'jobcards.create', label: 'إنشاء كرت عمل', admin: true, manager: true, user: true },
      { id: 'jobcards.edit', label: 'تعديل كرت عمل', admin: true, manager: true, user: false },
      { id: 'jobcards.close', label: 'إغلاق كرت عمل', admin: true, manager: true, user: false },
      { id: 'jobcards.delete', label: 'حذف كرت عمل', admin: true, manager: false, user: false },
    ],
  },
  {
    module: 'Forms',
    permissions: [
      { id: 'forms.view', label: 'عرض النماذج', admin: true, manager: true, user: true },
      { id: 'forms.print', label: 'طباعة PDF', admin: true, manager: true, user: true },
    ],
  },
  {
    module: 'Settings',
    permissions: [
      { id: 'settings.view', label: 'عرض الإعدادات', admin: true, manager: true, user: false },
      { id: 'settings.users', label: 'إدارة المستخدمين', admin: true, manager: false, user: false },
      { id: 'settings.permissions', label: 'إدارة الصلاحيات', admin: true, manager: false, user: false },
    ],
  },
]

export default function PermissionsManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          نظام الصلاحيات
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          الصلاحيات المحددة لكل دور في النظام
        </p>
      </div>

      {/* Roles Legend */}
      <div className="flex gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            مدير (Admin)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            مشرف (Manager)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            مستخدم (User)
          </span>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="space-y-6">
        {permissions.map((section) => (
          <div
            key={section.module}
            className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="bg-gray-50 dark:bg-slate-900 px-6 py-3 border-b border-gray-200 dark:border-slate-700">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {section.module}
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      الصلاحية
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      مدير
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      مشرف
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      مستخدم
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {section.permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {perm.label}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {perm.admin ? (
                          <CheckCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {perm.manager ? (
                          <CheckCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {perm.user ? (
                          <CheckCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
          ملاحظات مهمة:
        </h4>
        <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
          <li>المدير (Admin) لديه صلاحيات كاملة على النظام</li>
          <li>المشرف (Manager) يمكنه إدارة العمليات اليومية</li>
          <li>المستخدم (User) لديه صلاحيات محدودة للعرض والإنشاء فقط</li>
          <li>يتم تطبيق الصلاحيات تلقائياً عند تسجيل الدخول</li>
        </ul>
      </div>
    </div>
  )
}
