'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export default function MFASetup({ onComplete }) {
  const [step, setStep] = useState('setup') // 'setup', 'verify', 'enabled'
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [secret, setSecret] = useState(null)
  const [token, setToken] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadMFASetup()
  }, [])

  const loadMFASetup = async () => {
    try {
      const res = await fetch('/api/auth/mfa/setup')
      const data = await res.json()

      if (data.success) {
        if (data.mfaEnabled) {
          setStep('enabled')
        } else {
          setQrCodeUrl(data.qrCodeUrl)
          setSecret(data.secret)
          setStep('verify')
        }
      } else {
        toast.error(data.error?.message || 'Failed to load MFA setup')
      }
    } catch (error) {
      console.error('MFA setup error:', error)
      toast.error('Failed to load MFA setup')
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (token.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await res.json()

      if (data.success) {
        setBackupCodes(data.backupCodes)
        setStep('enabled')
        toast.success('MFA enabled successfully!')
        if (onComplete) onComplete()
      } else {
        toast.error(data.error?.message || 'Invalid token')
      }
    } catch (error) {
      console.error('MFA verify error:', error)
      toast.error('Failed to verify token')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'enabled') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900">MFA Enabled</h3>
            <p className="text-sm text-green-700">Your account is protected with two-factor authentication</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Setup Two-Factor Authentication</h3>
        <p className="text-sm text-gray-600 mb-4">
          Scan the QR code with an authenticator app like Google Authenticator or Authy
        </p>
      </div>

      {qrCodeUrl && (
        <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-lg">
          <img src={qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
          {secret && (
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Or enter this code manually:</p>
              <code className="text-sm font-mono bg-white px-3 py-2 rounded border">
                {secret}
              </code>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
            Enter 6-digit code from your authenticator app
          </label>
          <input
            id="token"
            type="text"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="000000"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || token.length !== 6}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify & Enable MFA'}
        </button>
      </form>

      {backupCodes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Save Your Backup Codes</h4>
          <p className="text-sm text-yellow-800 mb-3">
            These codes can be used to access your account if you lose your authenticator device.
            Save them in a safe place!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <code key={i} className="text-sm font-mono bg-white px-2 py-1 rounded border">
                {code}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

