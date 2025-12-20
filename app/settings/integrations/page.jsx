'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../../lib/fetch.js'

function IntegrationsContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [emailApiKey, setEmailApiKey] = useState('')
  const [calendarIntegrations, setCalendarIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)

  useEffect(() => {
    if (session) {
      loadCalendarStatus()
    }

    // Check for OAuth callback success/error
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success) {
      if (success === 'google_connected') {
        toast.success('Google Calendar connected successfully!')
      } else if (success === 'microsoft_connected') {
        toast.success('Microsoft Calendar connected successfully!')
      }
      loadCalendarStatus()
      // Clean URL
      router.replace('/settings/integrations')
    }
    
    if (error) {
      toast.error(`Calendar connection failed: ${error}`)
      router.replace('/settings/integrations')
    }
  }, [session, searchParams, router])

  const loadCalendarStatus = async () => {
    try {
      const response = await fetchJSON('/api/calendar/status')
      setCalendarIntegrations(response.integrations || [])
    } catch (error) {
      console.error('Failed to load calendar status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGoogle = async () => {
    setConnecting('GOOGLE')
    try {
      const response = await fetchJSON('/api/calendar/google/auth')
      if (response.authUrl) {
        window.location.href = response.authUrl
      }
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error)
      toast.error('Failed to connect Google Calendar')
      setConnecting(null)
    }
  }

  const handleConnectMicrosoft = async () => {
    setConnecting('MICROSOFT')
    try {
      const response = await fetchJSON('/api/calendar/microsoft/auth')
      if (response.authUrl) {
        window.location.href = response.authUrl
      }
    } catch (error) {
      console.error('Failed to initiate Microsoft OAuth:', error)
      toast.error('Failed to connect Microsoft Calendar')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (provider) => {
    if (!confirm(`Are you sure you want to disconnect ${provider} Calendar?`)) {
      return
    }

    try {
      await fetchJSON(`/api/calendar/disconnect?provider=${provider}`, {
        method: 'DELETE'
      })
      toast.success(`${provider} Calendar disconnected`)
      loadCalendarStatus()
    } catch (error) {
      console.error('Failed to disconnect calendar:', error)
      toast.error('Failed to disconnect calendar')
    }
  }

  const handleEmailSave = async () => {
    if (!emailApiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    // Note: Email API keys should be set in .env file for security
    // This UI is for reference only - show instructions
    toast(
      'Email API keys should be set in your .env file as RESEND_API_KEY. Please update your .env file and restart the server.',
      { 
        duration: 6000,
        icon: 'ℹ️'
      }
    )
    
    // Clear the input after showing message
    setEmailApiKey('')
  }

  const isConnected = (provider) => {
    return calendarIntegrations.some(
      i => i.provider === provider && i.connected
    )
  }

  if (!session) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Please sign in to access integrations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Integrations</h1>
      
      <div className="space-y-6">
        {/* Email Service */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Email Service</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure email provider for sending transactional emails (Resend/SendGrid)
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={emailApiKey}
                onChange={(e) => setEmailApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter API key"
              />
            </div>
            <button
              onClick={handleEmailSave}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Save API Key
            </button>
          </div>
        </div>

        {/* Calendar Integration */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Calendar Integration</h2>
          <p className="text-sm text-gray-600 mb-4">
            Connect Google Calendar or Microsoft Outlook to automatically sync interview events
          </p>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Google Calendar */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium">Google Calendar</h3>
                      <p className="text-sm text-gray-500">Sync interviews to your Google Calendar</p>
                    </div>
                  </div>
                  {isConnected('GOOGLE') ? (
                    <div className="flex items-center gap-3">
                      <span className="text-green-600 text-sm font-medium">✓ Connected</span>
                      <button
                        onClick={() => handleDisconnect('GOOGLE')}
                        className="text-red-600 text-sm hover:text-red-800"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={connecting === 'GOOGLE'}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {connecting === 'GOOGLE' ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {/* Microsoft Calendar */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium">Microsoft Outlook</h3>
                      <p className="text-sm text-gray-500">Sync interviews to your Outlook Calendar</p>
                    </div>
                  </div>
                  {isConnected('MICROSOFT') ? (
                    <div className="flex items-center gap-3">
                      <span className="text-green-600 text-sm font-medium">✓ Connected</span>
                      <button
                        onClick={() => handleDisconnect('MICROSOFT')}
                        className="text-red-600 text-sm hover:text-red-800"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectMicrosoft}
                      disabled={connecting === 'MICROSOFT'}
                      className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                      {connecting === 'MICROSOFT' ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <IntegrationsContent />
    </Suspense>
  )
}

