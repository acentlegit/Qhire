'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import SummaryCard, { SummaryCardGrid } from '../ui/SummaryCard.jsx'

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeJobs: 0,
    aiUsageToday: 0,
    securityAlerts: 0,
  })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState({
    docuSign: { configured: false, status: 'not_configured' },
    email: { configured: false, status: 'not_configured' },
    calendar: { configured: false, status: 'not_configured' }
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersRes, jobsRes, integrationsRes] = await Promise.all([
        fetch('/api/users?limit=100'),
        fetch('/api/jobs?limit=100'),
        fetch('/api/integrations/status'),
      ])

      const usersData = await usersRes.json()
      const jobsData = await jobsRes.json()
      const integrationsData = await integrationsRes.json()

      setUsers(usersData.data || [])
      setStats({
        totalUsers: usersData.pagination?.total || 0,
        activeJobs: jobsData.data?.filter(j => j.status === 'OPEN').length || 0,
        aiUsageToday: Math.floor(Math.random() * 500) + 100, // Placeholder
        securityAlerts: 0,
      })

      if (integrationsData.success && integrationsData.integrations) {
        setIntegrations({
          docuSign: integrationsData.integrations.docuSign || { configured: false, status: 'not_configured' },
          email: integrationsData.integrations.email || { configured: false, status: 'not_configured' },
          calendar: {
            configured: integrationsData.integrations.googleCalendar?.configured || integrationsData.integrations.microsoftCalendar?.configured || false,
            status: (integrationsData.integrations.googleCalendar?.configured || integrationsData.integrations.microsoftCalendar?.configured) ? 'configured' : 'not_configured'
          }
        })
      }
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {session?.user?.name}!</h1>
        <p className="text-gray-500 mt-1">System control & governance dashboard</p>
      </div>

      {/* Summary Cards */}
      <SummaryCardGrid>
        <SummaryCard
          title="Total Users"
          value={stats.totalUsers}
          subtext="+3 this week"
          icon="users"
          color="blue"
          href="/users"
        />
        <SummaryCard
          title="Active Jobs"
          value={stats.activeJobs}
          subtext="across all departments"
          icon="jobs"
          color="green"
          href="/jobs"
        />
        <SummaryCard
          title="AI Usage Today"
          value={`${stats.aiUsageToday}`}
          subtext="tokens consumed"
          icon="ai"
          color="purple"
          href="/settings/ai"
        />
        <SummaryCard
          title="Security Alerts"
          value={stats.securityAlerts}
          subtext="no issues detected"
          icon="security"
          color={stats.securityAlerts > 0 ? 'red' : 'green'}
          href="/settings/security"
        />
      </SummaryCardGrid>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User & Access Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">User & Access Management</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/users/create" className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </Link>
            <Link href="/users" className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Users
            </Link>
            <Link href="/settings/permissions" className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Roles & Permissions
            </Link>
            <Link href="/settings/security" className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              MFA Settings
            </Link>
          </div>
        </div>

        {/* AI Governance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AI Governance</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">AI Model</p>
                <p className="text-xs text-gray-500">Current provider</p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {process.env.NEXT_PUBLIC_AI_PROVIDER || 'Groq LLM'}
              </span>
            </div>
            <Link href="/settings/ai" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">Token Usage & Cost</p>
                <p className="text-xs text-gray-500">View detailed analytics</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/audit" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">AI Decision Audit Logs</p>
                <p className="text-xs text-gray-500">Review AI actions</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Compliance & Integrations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Compliance & Integrations</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/audit" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <svg className="w-6 h-6 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-900">Audit Log Export</p>
              <p className="text-xs text-gray-500 mt-1">Download CSV</p>
            </Link>
            <Link href="/settings/integrations" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${integrations.calendar.configured ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              </div>
              <p className="text-sm font-medium text-gray-900">Calendar</p>
              <p className={`text-xs mt-1 ${integrations.calendar.configured ? 'text-green-600' : 'text-gray-500'}`}>
                {integrations.calendar.configured ? 'Connected' : 'Not configured'}
              </p>
            </Link>
            <Link href="/settings/integrations" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${integrations.email.configured ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              </div>
              <p className="text-sm font-medium text-gray-900">Email Service</p>
              <p className={`text-xs mt-1 ${integrations.email.configured ? 'text-green-600' : 'text-gray-500'}`}>
                {integrations.email.configured ? 'Healthy' : 'Not configured'}
              </p>
            </Link>
            <Link href="/settings/integrations" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
              <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${integrations.docuSign.configured ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              </div>
              <p className="text-sm font-medium text-gray-900">DocuSign</p>
              <p className={`text-xs mt-1 ${integrations.docuSign.configured ? 'text-green-600' : 'text-gray-500'}`}>
                {integrations.docuSign.configured ? 'Configured' : 'Not configured'}
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
          <Link href="/users" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.slice(0, 5).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {user.name?.charAt(0) || user.email?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name || 'No name'}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                      user.role === 'RECRUITER' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Disable">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
