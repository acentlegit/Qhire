'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export default function RBACRollback() {
  const [role, setRole] = useState('RECRUITER')
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(1)
  const [loading, setLoading] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)

  useEffect(() => {
    loadVersions()
  }, [role])

  const loadVersions = async () => {
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/rbac/versions?role=${role}`)
      const data = await res.json()

      if (data.success) {
        setVersions(data.versions || [])
        if (data.versions && data.versions.length > 0) {
          setSelectedVersion(data.versions[0].version)
        }
      } else {
        toast.error(data.error?.message || 'Failed to load versions')
      }
    } catch (error) {
      console.error('Load versions error:', error)
      toast.error('Failed to load versions')
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleRollback = async () => {
    if (!selectedVersion) {
      toast.error('Please select a version to rollback to')
      return
    }

    if (!confirm(`Are you sure you want to rollback ${role} permissions to version ${selectedVersion}? This will create a new version with those permissions.`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rbac/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, version: selectedVersion })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`Successfully rolled back to version ${selectedVersion} (saved as version ${data.version})`)
        // Reload versions
        await loadVersions()
      } else {
        toast.error(data.error?.message || 'Failed to rollback')
      }
    } catch (error) {
      console.error('Rollback error:', error)
      toast.error('Failed to rollback permissions')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const getPermissionsCount = (permissions) => {
    if (Array.isArray(permissions)) {
      return permissions.length
    }
    if (typeof permissions === 'object') {
      return Object.keys(permissions).length
    }
    return 0
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">RBAC Policy Rollback</h3>
        <p className="text-sm text-gray-600">
          Rollback role permissions to a previous version. This creates a new version with the old permissions.
        </p>
      </div>

      {/* Role Selector */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="ADMIN">Admin</option>
          <option value="RECRUITER">Recruiter</option>
          <option value="HIRING_MANAGER">Hiring Manager</option>
        </select>
      </div>

      {/* Versions List */}
      {versionsLoading ? (
        <div className="text-center py-8">Loading versions...</div>
      ) : versions.length === 0 ? (
        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center text-gray-500">
          No versions found for {role}. Versions are created automatically when permissions change.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {versions.map((version) => (
                    <tr key={version.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        v{version.version}
                        {version.version === versions[0]?.version && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Current</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(version.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {version.createdByUser ? (
                          <div>
                            <div>{version.createdByUser.name || version.createdByUser.email}</div>
                            <div className="text-xs text-gray-500">{version.createdByUser.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getPermissionsCount(version.permissions)} items
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            setSelectedVersion(version.version)
                            handleRollback()
                          }}
                          disabled={loading || version.version === versions[0]?.version}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Rollback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manual Rollback */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or select version to rollback:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    Version {v.version} - {formatDate(v.createdAt)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleRollback}
                disabled={loading || !selectedVersion}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {loading ? 'Rolling back...' : 'Rollback to This Version'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

