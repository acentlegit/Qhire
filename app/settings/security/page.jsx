'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import MFASetup from '../../../components/security/MFASetup.jsx'
import SessionManagement from '../../../components/security/SessionManagement.jsx'
import DeviceManagement from '../../../components/security/DeviceManagement.jsx'
import AuditLogs from '../../../components/security/AuditLogs.jsx'
import RBACRollback from '../../../components/security/RBACRollback.jsx'

export default function SecuritySettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('mfa')
  const isAdmin = session?.user?.role === 'ADMIN'

  const tabs = [
    { id: 'mfa', label: 'Two-Factor Authentication', icon: '🔐' },
    { id: 'sessions', label: 'Active Sessions', icon: '📱' },
    { id: 'devices', label: 'Trusted Devices', icon: '🖥️' },
    ...(isAdmin ? [
      { id: 'audit', label: 'Audit Logs', icon: '📋' },
      { id: 'rbac', label: 'RBAC Rollback', icon: '🔄' }
    ] : [])
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Settings</h1>
          <p className="text-gray-600">
            Manage your account security, authentication, and device access
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'mfa' && (
              <div>
                <MFASetup />
              </div>
            )}

            {activeTab === 'sessions' && (
              <div data-tab="sessions">
                <p className="text-xs text-gray-400 mb-2">Debug: Sessions tab is active</p>
                <SessionManagement />
              </div>
            )}

            {activeTab === 'devices' && (
              <div data-tab="devices">
                <DeviceManagement />
              </div>
            )}

            {activeTab === 'audit' && isAdmin && (
              <div>
                <AuditLogs />
              </div>
            )}

            {activeTab === 'rbac' && isAdmin && (
              <div>
                <RBACRollback />
              </div>
            )}
            
            {/* Debug: Show active tab */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-400 mt-4 p-2 bg-gray-100 rounded">
                Debug: Active tab is "{activeTab}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
