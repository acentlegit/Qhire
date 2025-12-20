'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export default function SessionManagement() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeSession().then(() => {
      loadSessions()
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const initializeSession = async () => {
    try {
      await fetch('/api/auth/session/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      // Session might already exist
    }
  }

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/auth/sessions')
      const data = await res.json()

      if (data.success) {
        setSessions(data.sessions || [])
      } else {
        toast.error(data.error?.message || 'Failed to load sessions')
      }
    } catch (error) {
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const revokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to revoke this session?')) return

    try {
      const res = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Session revoked successfully')
        loadSessions()
      } else {
        toast.error(data.error?.message || 'Failed to revoke session')
      }
    } catch (error) {
      toast.error('Failed to revoke session')
    }
  }

  const revokeAllSessions = async () => {
    if (!confirm('Are you sure you want to revoke all other sessions? This will log you out from all other devices.')) return

    try {
      const res = await fetch('/api/auth/sessions?revokeAll=true', {
        method: 'DELETE'
      })

      const data = await res.json()

      if (data.success) {
        toast.success('All other sessions revoked')
        loadSessions()
      } else {
        toast.error(data.error?.message || 'Failed to revoke sessions')
      }
    } catch (error) {
      toast.error('Failed to revoke sessions')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getDeviceIcon = (device) => {
    if (!device) return '🖥️'
    if (device.type === 'mobile') return '📱'
    if (device.type === 'tablet') return '📱'
    return '🖥️'
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading sessions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Active Sessions</h3>
          <p className="text-sm text-gray-600">
            Manage your active login sessions across different devices
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={revokeAllSessions}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
          >
            Revoke All Others
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl">{getDeviceIcon(session.device)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">
                        {session.device?.name || 'Unknown Device'}
                      </h4>
                      {session.isCurrent && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      {session.device?.isTrusted && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Trusted
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {session.device && (
                        <p>{session.device.os} • {session.device.browser}</p>
                      )}
                      <p>IP: {session.ipAddress || 'Unknown'}</p>
                      <p>Last active: {formatDate(session.lastActivityAt)}</p>
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    className="text-sm text-red-600 hover:text-red-700 px-3 py-1 border border-red-300 rounded hover:bg-red-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
