'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import DashboardLayout from '../../components/layout/DashboardLayout.jsx'
import { format } from 'date-fns'

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [actionType, setActionType] = useState(null) // 'edit-role', 'reset-password', 'disable', 'enable'
  const [newRole, setNewRole] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchUsers()
  }, [session, status, router, page, searchQuery, filterRole, filterStatus])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filterRole && { role: filterRole }),
        ...(filterStatus && { status: filterStatus })
      })
      const res = await fetchJSON(`/api/users?${params}`)
      const usersData = Array.isArray(res) ? res : (res.data || [])
      setUsers(usersData)
      setTotal(res.pagination?.total || usersData.length)
    } catch (err) {
      console.error('Error fetching users:', err)
      toast.error(err.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterRole('')
    setFilterStatus('')
    setPage(1)
  }

  const hasActiveFilters = searchQuery || filterRole || filterStatus

  // Get initials for avatar
  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length === 1) return parts[0][0].toUpperCase()
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    if (email) return email[0].toUpperCase()
    return '?'
  }

  // Check if user is disabled
  const isUserDisabled = (user) => {
    if (user.lockedUntil) {
      const lockedDate = new Date(user.lockedUntil)
      return lockedDate > new Date()
    }
    return false
  }

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-700 dark:bg-blue-600 text-white'
      case 'RECRUITER':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
      case 'HIRING_MANAGER':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
  }

  // Get role tooltip
  const getRoleTooltip = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'Admins have full system access'
      case 'RECRUITER':
        return 'Recruiters can manage candidates and jobs'
      case 'HIRING_MANAGER':
        return 'Hiring Managers can review applications and make decisions'
      default:
        return ''
    }
  }

  // Handle actions
  const handleEditRole = (user) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setActionType('edit-role')
  }

  const handleResetPassword = (user) => {
    setSelectedUser(user)
    setNewPassword('')
    setActionType('reset-password')
  }

  const handleDisable = (user) => {
    setSelectedUser(user)
    setActionType('disable')
  }

  const handleEnable = (user) => {
    setSelectedUser(user)
    setActionType('enable')
  }

  const confirmAction = async () => {
    if (!selectedUser) return

    try {
      if (actionType === 'edit-role') {
        if (!newRole) {
          toast.error('Please select a role')
          return
        }
        // Cannot demote yourself
        if (selectedUser.id === session?.user?.id && newRole !== 'ADMIN') {
          toast.error('You cannot demote yourself')
          return
        }
        // Cannot delete/demote admins (only if changing to non-admin)
        if (selectedUser.role === 'ADMIN' && newRole !== 'ADMIN' && selectedUser.id !== session?.user?.id) {
          toast.error('Cannot change Admin role')
          return
        }
        await fetchJSON(`/api/users/${selectedUser.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: newRole })
        })
        toast.success('Role updated successfully')
      } else if (actionType === 'reset-password') {
        if (!newPassword || newPassword.length < 8) {
          toast.error('Password must be at least 8 characters')
          return
        }
        await fetchJSON(`/api/users/${selectedUser.id}/password`, {
          method: 'PATCH',
          body: JSON.stringify({ password: newPassword })
        })
        toast.success('Password reset successfully')
      } else if (actionType === 'disable') {
        await fetchJSON(`/api/users/${selectedUser.id}/disable`, {
          method: 'PATCH'
        })
        toast.success('User disabled successfully')
      } else if (actionType === 'enable') {
        await fetchJSON(`/api/users/${selectedUser.id}/enable`, {
          method: 'PATCH'
        })
        toast.success('User enabled successfully')
      }

      setSelectedUser(null)
      setActionType(null)
      setNewRole('')
      setNewPassword('')
      fetchUsers()
    } catch (err) {
      console.error('Error performing action:', err)
      toast.error(err.message || 'Failed to perform action')
    }
  }

  const cancelAction = () => {
    setSelectedUser(null)
    setActionType(null)
    setNewRole('')
    setNewPassword('')
  }

  if (status === 'loading' || (loading && users.length === 0)) {
    return (
      <DashboardLayout title="Users">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="User Management">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              👥 User Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage team members and access</p>
          </div>
          <Link
            href="/users/create"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            Add User
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search name or email"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Role</option>
              <option value="ADMIN">Admin</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        {users.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No users found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Invite team members to get started</p>
            <Link
              href="/users/create"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              Add User
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => {
                    const disabled = isUserDisabled(user)
                    const isCurrentUser = user.id === session?.user?.id
                    const isAdmin = user.role === 'ADMIN'

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {/* User Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold">
                              {getInitials(user.name, user.email)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {user.name || 'No name'}
                                </p>
                                {/* Security Indicators */}
                                {user.mfaEnabled && (
                                  <span
                                    className="text-xs"
                                    title="MFA enabled"
                                  >
                                    🔐
                                  </span>
                                )}
                                {user.Devices && user.Devices.length > 0 && (
                                  <span
                                    className="text-xs"
                                    title="Trusted device"
                                  >
                                    🖥
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                            title={getRoleTooltip(user.role)}
                          >
                            {user.role?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>

                        {/* Joined Column */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {format(new Date(user.createdAt), 'dd MMM yyyy')}
                          </span>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              disabled
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            }`}
                          >
                            {disabled ? 'Disabled' : 'Active'}
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit Role */}
                            <button
                              onClick={() => handleEditRole(user)}
                              disabled={isCurrentUser && isAdmin}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isCurrentUser && isAdmin ? 'Cannot demote yourself' : 'Edit Role'}
                            >
                              ✏️
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              🔐
                            </button>

                            {/* Disable/Enable */}
                            {disabled ? (
                              <button
                                onClick={() => handleEnable(user)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title="Enable User"
                              >
                                ✅
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDisable(user)}
                                disabled={isAdmin || isCurrentUser}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isAdmin ? 'Cannot disable Admin' : isCurrentUser ? 'Cannot disable yourself' : 'Disable User'}
                              >
                                🚫
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} users
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    ◀ Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= total}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modals */}
        {actionType && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={cancelAction}>
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {actionType === 'edit-role' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Edit Role</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Change role for <strong>{selectedUser.name || selectedUser.email}</strong>
                  </p>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="RECRUITER">Recruiter</option>
                    <option value="HIRING_MANAGER">Hiring Manager</option>
                  </select>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelAction}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Update Role
                    </button>
                  </div>
                </>
              )}

              {actionType === 'reset-password' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reset Password</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Set a new password for <strong>{selectedUser.name || selectedUser.email}</strong>
                  </p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={cancelAction}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Reset Password
                    </button>
                  </div>
                </>
              )}

              {actionType === 'disable' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Disable User?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    This will revoke access immediately.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Active sessions will be terminated.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelAction}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Disable User
                    </button>
                  </div>
                </>
              )}

              {actionType === 'enable' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enable User?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    This will restore access for <strong>{selectedUser.name || selectedUser.email}</strong>
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelAction}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Enable User
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
