'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import SummaryCard, { SummaryCardGrid } from '../ui/SummaryCard.jsx'

export default function HiringManagerDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState({
    myOpenJobs: 0,
    pendingFeedback: 0,
    interviewsToday: 0,
    offersToApprove: 0,
  })
  const [pendingCandidates, setPendingCandidates] = useState([])
  const [pendingOffers, setPendingOffers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [jobsRes, candidatesRes, offersRes, eventsRes] = await Promise.all([
        fetch('/api/jobs?limit=100'),
        fetch('/api/candidates?limit=10'),
        fetch('/api/offers?limit=10'),
        fetch('/api/events?limit=5'),
      ])

      const jobsData = await jobsRes.json()
      const candidatesData = await candidatesRes.json()
      const offersData = await offersRes.json()
      const eventsData = await eventsRes.json()

      const openJobs = jobsData.data?.filter(j => j.status === 'OPEN').length || 0
      const draftOffers = offersData.data?.filter(o => o.status === 'DRAFT').length || 0

      setStats({
        myOpenJobs: openJobs,
        pendingFeedback: Math.floor(Math.random() * 8) + 2, // Placeholder
        interviewsToday: eventsData.data?.filter(e => {
          const today = new Date().toDateString()
          return new Date(e.start).toDateString() === today
        }).length || 0,
        offersToApprove: draftOffers,
      })

      setPendingCandidates(candidatesData.data?.slice(0, 5) || [])
      setPendingOffers(offersData.data?.filter(o => o.status === 'DRAFT').slice(0, 5) || [])
    } catch (error) {
      console.error('Error loading hiring manager data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (candidateId) => {
    toast.success('Candidate approved!')
    // API call here
  }

  const handleReject = (candidateId) => {
    toast('Candidate rejected', { icon: 'ℹ️' })
    // API call here
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {session?.user?.name}!</h1>
        <p className="text-gray-500 mt-1">Review candidates and make hiring decisions</p>
      </div>

      {/* Summary Cards */}
      <SummaryCardGrid>
        <SummaryCard
          title="My Open Jobs"
          value={stats.myOpenJobs}
          subtext="active positions"
          icon="jobs"
          color="blue"
          href="/jobs"
        />
        <SummaryCard
          title="Pending Feedback"
          value={stats.pendingFeedback}
          subtext="awaiting your review"
          icon="feedback"
          color="orange"
          href="/candidates"
        />
        <SummaryCard
          title="Interviews Today"
          value={stats.interviewsToday}
          subtext="scheduled"
          icon="calendar"
          color="green"
          href="/calendar"
        />
        <SummaryCard
          title="Offers to Approve"
          value={stats.offersToApprove}
          subtext="pending approval"
          icon="offer"
          color="purple"
          href="/offers"
        />
      </SummaryCardGrid>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Jobs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">My Jobs</h2>
          </div>
          <div className="space-y-3">
            <Link href="/jobs" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">View All Jobs</p>
                <p className="text-xs text-gray-500">{stats.myOpenJobs} open positions</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/pipeline" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">Pipeline View</p>
                <p className="text-xs text-gray-500">See candidate progress</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Interviews */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Interviews</h2>
          </div>
          <div className="space-y-3">
            <Link href="/calendar" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">Interview Schedule</p>
                <p className="text-xs text-gray-500">{stats.interviewsToday} today</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Interview Recordings</p>
                <p className="text-xs text-gray-500">Watch & review</p>
              </div>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                AI Summary
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Review */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Candidate Review</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              {stats.pendingFeedback} pending
            </span>
          </div>
          <Link href="/candidates" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {pendingCandidates.length > 0 ? pendingCandidates.map((candidate) => (
            <div key={candidate.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-lg">
                    {candidate.name?.charAt(0) || 'C'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      AI Score: 85%
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{candidate.email}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded">Skills: {candidate.skills || 'Not specified'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link 
                    href={`/candidate/${candidate.id}`}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    View Resume
                  </Link>
                  <button 
                    onClick={() => handleApprove(candidate.id)}
                    className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button 
                    onClick={() => handleReject(candidate.id)}
                    className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No candidates pending review</p>
            </div>
          )}
        </div>
      </div>

      {/* Approvals */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {stats.offersToApprove} offers
            </span>
          </div>
          <Link href="/offers" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="p-4">
          {pendingOffers.length > 0 ? (
            <div className="space-y-3">
              {pendingOffers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Offer for {offer.application?.candidate?.name || 'Candidate'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {offer.application?.job?.title || 'Position'} • ${offer.salary?.toLocaleString() || 'TBD'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/offer/${offer.id}`}
                      className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Review
                    </Link>
                    <button className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <p>No pending approvals</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
