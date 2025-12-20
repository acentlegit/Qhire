'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import Link from 'next/link'

const EVENT_TYPES = ['INTERVIEW', 'MEETING', 'CALL', 'ASSESSMENT', 'OTHER']

export default function Calendar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [view, setView] = useState('month') // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date())
  const [applications, setApplications] = useState([])

  const [formData, setFormData] = useState({
    applicationId: '',
    title: '',
    description: '',
    type: 'INTERVIEW',
    start: '',
    end: '',
    location: '',
    attendees: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchEvents()
    fetchJSON('/api/applications?limit=100')
      .then(r => setApplications(Array.isArray(r) ? r : (r.data || [])))
      .catch(() => {})
  }, [session, status, router, currentDate])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      startOfMonth.setHours(0, 0, 0, 0)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      endOfMonth.setHours(23, 59, 59, 999)
      
      console.log('Fetching events for:', { start: startOfMonth, end: endOfMonth })
      
      const response = await fetchJSON(
        `/api/events?start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}&limit=100`
      )
      
      console.log('Events response:', response)
      
      const eventsData = Array.isArray(response) ? response : (response.data || [])
      console.log('Parsed events:', eventsData.length, eventsData)
      setEvents(eventsData)
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const handleDateClick = (date) => {
    setSelectedDate(date)
    const dateStr = date.toISOString().slice(0, 16)
    setFormData(prev => ({
      ...prev,
      start: dateStr,
      end: new Date(new Date(date).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
    }))
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetchJSON('/api/events', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      toast.success('Event created successfully')
      setShowModal(false)
      setFormData({
        applicationId: '',
        title: '',
        description: '',
        type: 'INTERVIEW',
        start: '',
        end: '',
        location: '',
        attendees: ''
      })
      fetchEvents()
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error(error.message || 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    
    try {
      await fetchJSON(`/api/events/${eventId}`, { method: 'DELETE' })
      toast.success('Event deleted')
      fetchEvents()
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    }
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }

  const getEventsForDate = (date) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(event => {
      if (!event || !event.start) return false
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const days = getDaysInMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + New Event
        </button>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            ← Previous
          </button>
          <h2 className="text-2xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {dayNames.map(day => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {days.map((date, index) => {
            const dayEvents = getEventsForDate(date)
            return (
              <div
                key={index}
                onClick={() => date && handleDateClick(date)}
                className={`min-h-24 p-2 border border-gray-200 rounded ${
                  date ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
                }`}
              >
                {date && (
                  <>
                    <div className="font-medium text-gray-700 mb-1">
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <div key={event.id} className="flex gap-1">
                        <Link
                          href={`/event/${event.id}`}
                            className="flex-1 block text-xs bg-blue-100 text-blue-800 rounded px-1 truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {event.title}
                        </Link>
                          {event.type === 'INTERVIEW' && (
                            <Link
                              href={`/interview/${event.id}`}
                              className="text-xs bg-purple-100 text-purple-800 rounded px-1 hover:bg-purple-200"
                              onClick={(e) => e.stopPropagation()}
                              title="Start AI Interview"
                            >
                              🎥
                            </Link>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Events</h2>
        <div className="space-y-3">
          {events
            .filter(event => new Date(event.start) >= new Date())
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 10)
            .map(event => (
              <div key={event.id} className="flex justify-between items-center p-3 border border-gray-200 rounded">
                <div>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleString()}
                  </div>
                  {event.application && (
                    <div className="text-sm text-gray-500">
                      {event.application.candidate?.name} - {event.application.job?.title}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {event.type === 'INTERVIEW' && (
                    <Link
                      href={`/interview/${event.id}`}
                      className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      🎥 Start AI Interview
                    </Link>
                  )}
                <button
                  onClick={() => handleDelete(event.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
                </div>
              </div>
            ))}
          {events.filter(e => new Date(e.start) >= new Date()).length === 0 && (
            <p className="text-gray-500 text-center py-4">No upcoming events</p>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create Event</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Application
                </label>
                <select
                  value={formData.applicationId}
                  onChange={(e) => setFormData(prev => ({ ...prev, applicationId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">None</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.candidate?.name} - {app.job?.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start}
                    onChange={(e) => setFormData(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end}
                    onChange={(e) => setFormData(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Zoom, Office, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
