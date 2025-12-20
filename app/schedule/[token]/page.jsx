'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import TimePicker from '../../../components/scheduling/TimePicker'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../../lib/fetch.js'

function SchedulePageContent() {
  const params = useParams()
  const token = params.token
  const [schedulingLink, setSchedulingLink] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) {
      fetchSchedulingLink()
    }
  }, [token])

  const fetchSchedulingLink = async () => {
    try {
      const response = await fetchJSON(`/api/scheduling/link?token=${token}`)
      setSchedulingLink(response.schedulingLink)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching scheduling link:', error)
      toast.error('Invalid or expired scheduling link')
      setLoading(false)
    }
  }

  const handleTimeSelect = (slot) => {
    setSelectedSlot(slot)
  }

  const handleSubmit = async () => {
    if (!selectedSlot) {
      toast.error('Please select a time slot')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchJSON('/api/scheduling/book', {
        method: 'POST',
        body: JSON.stringify({
          token: token,
          start: selectedSlot.start.toISOString(),
          end: selectedSlot.end.toISOString(),
        }),
      })

      toast.success('Interview scheduled successfully!')
      // Redirect or show confirmation
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (error) {
      console.error('Error booking slot:', error)
      toast.error('Failed to schedule interview. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading scheduling options...</p>
        </div>
      </div>
    )
  }

  if (!schedulingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Scheduling Link</h1>
          <p className="text-gray-600">This scheduling link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Your Interview</h1>
          <p className="text-gray-600 mb-8">
            Please select a convenient time slot for your interview.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <TimePicker
            availableSlots={schedulingLink.availableSlots || []}
            duration={schedulingLink.duration || 30}
            timezone={schedulingLink.timezone || 'UTC'}
            onTimeSelect={handleTimeSelect}
            selectedDate={selectedDate}
          />

          {selectedSlot && (
            <div className="mt-8">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Scheduling...' : 'Confirm Interview Time'}
              </button>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-500">
            <p>Duration: {schedulingLink.duration || 30} minutes</p>
            <p>Timezone: {schedulingLink.timezone || 'UTC'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SchedulePageContent />
    </Suspense>
  )
}

