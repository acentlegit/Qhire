'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout.jsx'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isToday, parseISO } from 'date-fns'

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [view, setView] = useState('week') // day, week, month
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      loadEvents()
    }
  }, [status, currentDate, view])

  const loadEvents = async () => {
    try {
      setLoading(true)
      let start, end
      
      if (view === 'day') {
        start = format(currentDate, 'yyyy-MM-dd')
        end = format(addDays(currentDate, 1), 'yyyy-MM-dd')
      } else if (view === 'week') {
        start = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        end = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      } else {
        start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
        end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
      }

      const data = await fetchJSON(`/api/calendar/events?start=${start}&end=${end}`)
      setEvents(data.events || [])
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigatePrev = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, -1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subMonths(currentDate, 1))
  }

  const navigateNext = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addMonths(currentDate, 1))
  }

  const goToToday = () => setCurrentDate(new Date())

  const openEventDrawer = (event) => {
    setSelectedEvent(event)
    setShowDrawer(true)
  }

  const closeDrawer = () => {
    setShowDrawer(false)
    setSelectedEvent(null)
  }

  const joinInterview = (event) => {
    if (event.type === 'AI_INTERVIEW') {
      router.push(`/interview/${event.id}`)
    } else if (event.meetingLink) {
      window.open(event.meetingLink, '_blank')
    } else {
      toast.error('No meeting link available')
    }
  }

  // Get week days for week view
  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  // Get events for a specific day
  const getEventsForDay = (date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.startTime)
      return isSameDay(eventDate, date)
    })
  }

  // Get upcoming events (next 5)
  const upcomingEvents = events
    .filter(e => new Date(e.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 5)

  if (status === 'loading') {
    return (
      <DashboardLayout title="Calendar">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Interviews">
      <div className="flex gap-6 h-full">
        {/* Main Calendar */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                📅 Interviews
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Manage and track all scheduled interviews
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/calendar/schedule')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Schedule Interview
              </button>
            </div>
          </div>

          {/* Calendar Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex items-center justify-between">
              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={navigatePrev}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={navigateNext}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white ml-4">
                  {view === 'day' && format(currentDate, 'MMMM d, yyyy')}
                  {view === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
                  {view === 'month' && format(currentDate, 'MMMM yyyy')}
                </h2>
              </div>

              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {['day', 'week', 'month'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                      view === v
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {view === 'week' && (
              <>
                {/* Week Header */}
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                  {getWeekDays().map((day, i) => (
                    <div
                      key={i}
                      className={`p-3 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                        isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                        {format(day, 'EEE')}
                      </p>
                      <p className={`text-lg font-semibold mt-1 ${
                        isToday(day) 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {format(day, 'd')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Week Body */}
                <div className="grid grid-cols-7 min-h-[400px]">
                  {getWeekDays().map((day, i) => (
                    <div
                      key={i}
                      className={`p-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                        isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        {getEventsForDay(day).map((event) => (
                          <EventCard key={event.id} event={event} onClick={() => openEventDrawer(event)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {view === 'day' && (
              <div className="p-4 min-h-[400px]">
                <div className="space-y-3">
                  {getEventsForDay(currentDate).length > 0 ? (
                    getEventsForDay(currentDate).map((event) => (
                      <EventCard key={event.id} event={event} onClick={() => openEventDrawer(event)} large />
                    ))
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>
            )}

            {view === 'month' && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Month view coming soon...
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upcoming Interviews
            </h3>
            
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => openEventDrawer(event)}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        event.type === 'AI_INTERVIEW' ? 'bg-purple-500' : 'bg-blue-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {event.candidate?.name || event.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {format(parseISO(event.startTime), 'MMM d, h:mm a')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            event.type === 'AI_INTERVIEW'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {event.type === 'AI_INTERVIEW' ? '🤖 AI' : '👨‍💼 Human'}
                          </span>
                          {event.isVideo && (
                            <span className="text-xs text-gray-400">🎥</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Event Drawer */}
        {showDrawer && selectedEvent && (
          <EventDrawer 
            event={selectedEvent} 
            onClose={closeDrawer}
            onJoin={() => joinInterview(selectedEvent)}
            onReschedule={() => {
              closeDrawer()
              router.push(`/calendar/reschedule/${selectedEvent.id}`)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

// Event Card Component
function EventCard({ event, onClick, large = false }) {
  const startTime = parseISO(event.startTime)
  const endTime = event.endTime ? parseISO(event.endTime) : null
  
  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg cursor-pointer transition-all hover:shadow-md
        ${event.type === 'AI_INTERVIEW' 
          ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500' 
          : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
        }
        ${large ? 'p-4' : 'p-2'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Time */}
          <p className={`font-medium text-gray-900 dark:text-white ${large ? 'text-sm' : 'text-xs'}`}>
            🕒 {format(startTime, 'HH:mm')}
            {endTime && ` – ${format(endTime, 'HH:mm')}`}
          </p>
          
          {/* Candidate */}
          <p className={`text-gray-700 dark:text-gray-200 truncate mt-0.5 ${large ? 'text-base font-medium' : 'text-xs'}`}>
            👤 {event.candidate?.name || event.title || 'Interview'}
          </p>
          
          {/* Job */}
          {event.job?.title && (
            <p className={`text-gray-500 dark:text-gray-400 truncate ${large ? 'text-sm' : 'text-xs'}`}>
              📄 {event.job.title}
            </p>
          )}
          
          {/* Type Badge */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              event.type === 'AI_INTERVIEW'
                ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200'
                : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
            }`}>
              {event.type === 'AI_INTERVIEW' ? '🤖 AI' : '👨‍💼 Human'}
            </span>
            {event.isVideo && <span className="text-xs">🎥</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">📅</span>
      </div>
      <p className="text-gray-600 dark:text-gray-300 font-medium">No interviews scheduled</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">You're all clear for now.</p>
    </div>
  )
}

// Event Drawer Component
function EventDrawer({ event, onClose, onJoin, onReschedule }) {
  const startTime = parseISO(event.startTime)
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      ></div>
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Interview Details
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Candidate */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-semibold">
                {(event.candidate?.name || 'C').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {event.candidate?.name || 'Candidate'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {event.job?.title || 'Interview'}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-lg">📅</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(startTime, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {format(startTime, 'h:mm a')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-lg">{event.type === 'AI_INTERVIEW' ? '🤖' : '👨‍💼'}</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Interview Type</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {event.type === 'AI_INTERVIEW' ? 'AI Interview' : 'Human Interview'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-lg">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  event.status === 'COMPLETED' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : event.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {event.status || 'Scheduled'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onJoin}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              ▶️ Join Interview
            </button>
            <button
              onClick={onReschedule}
              className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              🔁 Reschedule
            </button>
            <button
              className="w-full py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              ❌ Cancel Interview
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
