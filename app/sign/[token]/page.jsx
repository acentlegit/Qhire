'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export default function SignOfferPage() {
  const { token } = useParams()
  const router = useRouter()
  const canvasRef = useRef(null)
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [offer, setOffer] = useState(null)
  const [error, setError] = useState(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    fetchSignatureDetails()
  }, [token])

  useEffect(() => {
    // Initialize canvas for signature
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [loading])

  const fetchSignatureDetails = async () => {
    try {
      const res = await fetch(`/api/signature/${token}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load offer')
      }

      setOffer(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMouseDown = (e) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleMouseMove = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleTouchStart = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY })
  }

  const handleTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY })
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSign = async () => {
    if (!hasSignature) {
      toast.error('Please draw your signature')
      return
    }

    if (!agreedToTerms) {
      toast.error('Please agree to the terms')
      return
    }

    setSubmitting(true)

    try {
      const canvas = canvasRef.current
      const signatureImage = canvas.toDataURL('image/png')

      const res = await fetch(`/api/signature/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          signatureImage,
          agreedToTerms,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign')
      }

      toast.success('Offer signed successfully!')
      setOffer(prev => ({ ...prev, status: 'SIGNED' }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this offer?')) return

    setSubmitting(true)

    try {
      const res = await fetch(`/api/signature/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline')
      }

      toast('Offer declined', { icon: 'ℹ️' })
      setOffer(prev => ({ ...prev, status: 'DECLINED' }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Offer</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (offer?.status === 'SIGNED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Offer Signed!</h1>
          <p className="text-gray-600">
            Thank you, {offer.signerName}! Your signed offer has been submitted.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Signed on {new Date(offer.signedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    )
  }

  if (offer?.status === 'DECLINED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Offer Declined</h1>
          <p className="text-gray-600">
            You have declined this offer.
          </p>
        </div>
      </div>
    )
  }

  if (offer?.status === 'EXPIRED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">
            This signing link has expired. Please contact HR for a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Offer Letter</h1>
          <p className="text-gray-600 mt-2">
            Please review and sign your offer below
          </p>
        </div>

        {/* Offer Details */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Offer Details</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Position</label>
              <p className="font-medium">{offer.offer?.jobTitle || 'Position'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Department</label>
              <p className="font-medium">{offer.offer?.department || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Salary</label>
              <p className="font-medium">
                {offer.offer?.salary 
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: offer.offer.currency || 'USD' }).format(offer.offer.salary)
                  : 'As discussed'
                }
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Start Date</label>
              <p className="font-medium">
                {offer.offer?.startDate 
                  ? new Date(offer.offer.startDate).toLocaleDateString()
                  : 'To be determined'
                }
              </p>
            </div>
          </div>

          {offer.offer?.benefits && (
            <div className="mt-4">
              <label className="text-sm text-gray-500">Benefits</label>
              <p className="font-medium whitespace-pre-wrap">
                {typeof offer.offer.benefits === 'string' 
                  ? offer.offer.benefits 
                  : offer.offer.benefits?.join(', ')
                }
              </p>
            </div>
          )}

          {offer.offer?.terms && (
            <div className="mt-4">
              <label className="text-sm text-gray-500">Additional Terms</label>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{offer.offer.terms}</p>
            </div>
          )}
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Signature</h2>
          <p className="text-sm text-gray-600 mb-4">
            Draw your signature in the box below using your mouse or touch screen.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden mb-4">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            />
          </div>

          <button
            onClick={clearSignature}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear signature
          </button>
        </div>

        {/* Terms Agreement */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I, <strong>{offer.signerName}</strong>, confirm that I have read and accept this offer letter. 
              I understand that this electronic signature constitutes my legal signature.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSign}
            disabled={submitting || !hasSignature || !agreedToTerms}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Signing...' : 'Accept & Sign Offer'}
          </button>
          <button
            onClick={handleDecline}
            disabled={submitting}
            className="px-6 py-3 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>This signing link expires on {new Date(offer.expiresAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}

