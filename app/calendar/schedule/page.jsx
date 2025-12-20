'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout.jsx'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

export default function ScheduleInterviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  
  const [formData, setFormData] = useState({
    candidateId: '',
    jobId: '',
    type: 'AI_INTERVIEW',
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 30,
    notes: ''
  })

  useEffect(() => {
    if (status === 'authenticated') {
      loadData()
    }
  }, [status])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [candidatesRes, jobsRes] = await Promise.all([
        fetchJSON('/api/candidates?limit=100'),
        fetchJSON('/api/jobs?status=OPEN&limit=100')
      ])
      const candidatesData = candidatesRes?.candidates || candidatesRes?.data || candidatesRes
      const jobsData = jobsRes?.jobs || jobsRes?.data || jobsRes
      setCandidates(Array.isArray(candidatesData) ? candidatesData : [])
      setJobs(Array.isArray(jobsData) ? jobsData : [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.candidateId) {
      toast.error('Please select a candidate')
      return
    }

    setLoading(true)
    try {
      const startTime = new Date(`${formData.date}T${formData.time}`)
      const endTime = new Date(startTime.getTime() + formData.duration * 60000)

      await fetchJSON('/api/calendar/events', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: formData.candidateId,
          jobId: formData.jobId || null,
          type: formData.type,
          title: `${formData.type === 'AI_INTERVIEW' ? 'AI Interview' : 'Interview'} - ${
            candidates.find(c => c.id === formData.candidateId)?.name || 'Candidate'
          }`,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: formData.notes,
          isVideo: true
        })
      })

      toast.success('Interview scheduled successfully!')
      router.push('/calendar')
    } catch (error) {
      console.error('Error scheduling interview:', error)
      toast.error(error.message || 'Failed to schedule interview')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loadingData) {
    return (
      <DashboardLayout title="Schedule Interview">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Schedule Interview">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 flex items-center gap-1"
          >
            ← Back to Calendar
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule Interview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Set up an AI or human interview with a candidate
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            
            {/* Interview Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Interview Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'AI_INTERVIEW' }))}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.type === 'AI_INTERVIEW'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      formData.type === 'AI_INTERVIEW' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      🤖
                    </div>
                    <div>
                      <p className={`font-medium ${
                        formData.type === 'AI_INTERVIEW' 
                          ? 'text-purple-700 dark:text-purple-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        AI Interview
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automated screening
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'HUMAN_INTERVIEW' }))}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.type === 'HUMAN_INTERVIEW'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      formData.type === 'HUMAN_INTERVIEW' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      👨‍💼
                    </div>
                    <div>
                      <p className={`font-medium ${
                        formData.type === 'HUMAN_INTERVIEW' 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        Human Interview
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        With recruiter/manager
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Candidate */}
            <div>
              <label htmlFor="candidateId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Candidate *
              </label>
              <select
                id="candidateId"
                name="candidateId"
                value={formData.candidateId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a candidate</option>
                {candidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} {candidate.email ? `(${candidate.email})` : ''}
                  </option>
                ))}
              </select>
              {candidates.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  No candidates found. <a href="/candidates/new" className="text-blue-600 hover:underline">Add a candidate</a>
                </p>
              )}
            </div>

            {/* Job (Optional) */}
            <div>
              <label htmlFor="jobId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Job Position (Optional)
              </label>
              <select
                id="jobId"
                name="jobId"
                value={formData.jobId}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No specific job</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Time *
                </label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration
              </label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any special instructions or topics to cover..."
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.candidateId}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Scheduling...' : 'Schedule Interview'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}

