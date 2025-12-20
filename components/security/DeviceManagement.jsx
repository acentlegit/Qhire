'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export default function DeviceManagement() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeSession().then(() => {
      loadDevices()
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

  const loadDevices = async () => {
    try {
      const res = await fetch('/api/auth/devices')
      const data = await res.json()

      if (data.success) {
        setDevices(data.devices || [])
      } else {
        toast.error(data.error?.message || 'Failed to load devices')
      }
    } catch (error) {
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const handleDeviceAction = async (deviceId, action) => {
    try {
      const res = await fetch('/api/auth/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message)
        loadDevices()
      } else {
        toast.error(data.error?.message || 'Failed to perform action')
      }
    } catch (error) {
      toast.error('Failed to perform action')
    }
  }

  const trustDevice = (deviceId) => {
    if (confirm('Trust this device? Trusted devices will have reduced security checks.')) {
      handleDeviceAction(deviceId, 'trust')
    }
  }

  const revokeDevice = (deviceId) => {
    if (confirm('Revoke access for this device? All sessions on this device will be terminated.')) {
      handleDeviceAction(deviceId, 'revoke')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getDeviceIcon = (device) => {
    if (device.type === 'mobile') return '📱'
    if (device.type === 'tablet') return '📱'
    return '🖥️'
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading devices...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Trusted Devices</h3>
        <p className="text-sm text-gray-600">
          Manage devices that have access to your account
        </p>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No devices found
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl">{getDeviceIcon(device)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{device.name || 'Unknown Device'}</h4>
                      {device.isTrusted && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Trusted
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{device.os} • {device.browser}</p>
                      <p>Active sessions: {device.activeSessions}</p>
                      <p>First seen: {formatDate(device.firstSeenAt)}</p>
                      <p>Last seen: {formatDate(device.lastSeenAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!device.isTrusted && (
                    <button
                      onClick={() => trustDevice(device.id)}
                      className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Trust
                    </button>
                  )}
                  <button
                    onClick={() => revokeDevice(device.id)}
                    className="text-sm text-red-600 hover:text-red-700 px-3 py-1 border border-red-300 rounded hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
