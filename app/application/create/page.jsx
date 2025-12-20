'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'

const STAGES = ['Applied','Screen','Interview','Offer','Hired','Rejected']

// small helper: always return an array
const toArray = (res) => {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

export default function ApplicationCreate() {
  const { data: session, status } = useSession()
  const [jobs, setJobs] = useState([])
  const [candidates, setCandidates] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [stage, setStage] = useState('Applied')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/auth/signin'); return }

    // Fetch reasonable page size for dropdowns
    const q = '?page=1&limit=100'

    Promise.all([
      fetchJSON(`/api/jobs${q}`).then(r => toArray(r)),
      fetchJSON(`/api/candidates${q}`).then(r => toArray(r))
    ])
    .then(([jobsData, candidatesData]) => {
      setJobs(jobsData)
      setCandidates(candidatesData)
    })
    .catch(err => {
      console.error('Error fetching data:', err)
      toast.error(err.message || 'Error loading jobs/candidates')
      setMsg('Error loading jobs/candidates')
    })
    .finally(() => setFetching(false))
  }, [session, status, router])

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setMsg('')

    if (!selectedJob || !selectedCandidate) {
      setMsg('Please select both a job and a candidate')
      setLoading(false)
      return
    }

    try {
      await fetchJSON('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId: selectedJob, candidateId: selectedCandidate, stage })
      })
      
      toast.success('Application created successfully!')
      setMsg('Application created successfully!')
      setSelectedJob('')
      setSelectedCandidate('')
      setStage('Applied')
      setTimeout(() => router.push('/dashboard'), 800)
    } catch (error) {
      const errorMsg = error.message || 'Error creating application'
      setMsg(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || fetching) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }
  if (!session) return null

  const hasJobs = Array.isArray(jobs) && jobs.length > 0
  const hasCandidates = Array.isArray(candidates) && candidates.length > 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Application</h1>
      <form onSubmit={submit} className="space-y-4 bg-white rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Job *</label>
          <select
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            required
          >
            <option value="">{hasJobs ? 'Choose a job...' : 'No jobs found'}</option>
            {hasJobs && jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({job.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select Candidate *</label>
          <select
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCandidate}
            onChange={e => setSelectedCandidate(e.target.value)}
            required
          >
            <option value="">{hasCandidates ? 'Choose a candidate...' : 'No candidates found'}</option>
            {hasCandidates && candidates.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Initial Stage *</label>
          <select
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={stage}
            onChange={e => setStage(e.target.value)}
            required
          >
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedJob || !selectedCandidate}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Application'}
        </button>

        {msg && (
          <p className={`mt-2 ${msg.toLowerCase().includes('error') ? 'text-red-600' : 'text-green-600'}`}>
            {msg}
          </p>
        )}
      </form>
    </div>
  )
}
