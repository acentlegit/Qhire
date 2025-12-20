'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'
import Link from 'next/link'

function BulkResultsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const batchJobId = searchParams.get('batchJobId')
  
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [sendingEmails, setSendingEmails] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    } else if (session.user?.role !== 'RECRUITER' && session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    if (batchJobId) {
      loadResults()
    }
  }, [batchJobId])

  const loadResults = async () => {
    try {
      const data = await fetchJSON(`/api/ai/bulk-parse?batchJobId=${batchJobId}`)
      setResults(data)
      
      // Auto-select candidates with emails and match scores > 0.7
      if (data.results) {
        const topMatches = data.results
          .filter(r => r.status === 'SUCCESS' && r.email && r.matchScore && r.matchScore > 0.7)
          .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
          .slice(0, 10)
          .map(r => r.id)
        setSelectedCandidates(topMatches)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
      setLoading(false)
    }
  }

  const toggleCandidate = (resultId) => {
    setSelectedCandidates(prev => 
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    )
  }

  const selectAll = () => {
    if (!results?.results) return
    const allWithEmails = results.results
      .filter(r => r.status === 'SUCCESS' && r.email)
      .map(r => r.id)
    setSelectedCandidates(allWithEmails)
  }

  const deselectAll = () => {
    setSelectedCandidates([])
  }

  const sendBulkEmails = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Please select at least one candidate')
      return
    }

    setSendingEmails(true)
    try {
      const selectedResults = results.results.filter(r => selectedCandidates.includes(r.id))
      const candidates = selectedResults.map(r => ({
        email: r.email,
        candidateId: r.candidateId,
        name: r.candidate?.name || r.parsedData?.name || 'Candidate'
      }))

      const response = await fetchJSON('/api/ai/bulk-email', {
        method: 'POST',
        body: JSON.stringify({
          jobId: results.jobId,
          candidates,
          options: {
            includeSchedulingLink: true
          }
        })
      })

      toast.success(`Emails sent to ${response.sent} candidates!`)
      
      // Refresh results
      loadResults()
    } catch (error) {
      console.error('Error sending emails:', error)
      toast.error(error.message || 'Failed to send emails')
    } finally {
      setSendingEmails(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!session || !results) {
    return null
  }

  const allResults = results.results || []
  const successfulResults = allResults.filter(r => r.status === 'SUCCESS')
  const errorResults = allResults.filter(r => r.status === 'ERROR')
  const resultsWithEmails = successfulResults.filter(r => r.email)
  const topMatches = successfulResults
    .filter(r => r.matchScore && r.matchScore > 0.7)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/recruiter/bulk-upload" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
          ← Back to Bulk Upload
        </Link>
        <h1 className="text-3xl font-bold mb-2">Bulk Processing Results</h1>
        <p className="text-gray-600">
          Review parsed resumes, select candidates, and send emails with one click.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Processed</p>
          <p className="text-2xl font-bold">{results.processedFiles}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">With Emails</p>
          <p className="text-2xl font-bold text-blue-600">{resultsWithEmails.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Top Matches</p>
          <p className="text-2xl font-bold text-green-600">{topMatches.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Errors</p>
          <p className="text-2xl font-bold text-red-600">{results.errorFiles}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Select All with Emails
            </button>
            <button
              onClick={deselectAll}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Deselect All
            </button>
          </div>
          <button
            onClick={sendBulkEmails}
            disabled={selectedCandidates.length === 0 || sendingEmails}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {sendingEmails ? 'Sending...' : `📧 Send Emails to ${selectedCandidates.length} Candidates`}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.length === resultsWithEmails.length && resultsWithEmails.length > 0}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Successful Results */}
              {successfulResults.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {result.email && (
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(result.id)}
                        onChange={() => toggleCandidate(result.id)}
                        className="rounded border-gray-300"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {result.candidate?.name || result.parsedData?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">{result.filename}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {result.email ? (
                      <span className="text-sm text-gray-900">{result.email}</span>
                    ) : (
                      <span className="text-sm text-gray-400">No email found</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {result.matchScore ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          result.matchScore > 0.7 ? 'text-green-600' :
                          result.matchScore > 0.5 ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          {(result.matchScore * 100).toFixed(0)}%
                        </span>
                        {result.matchScore > 0.7 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Top Match</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      result.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {result.candidateId && (
                      <Link
                        href={`/candidate/${result.candidateId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Profile →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              
              {/* Error Results */}
              {errorResults.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50 bg-red-50">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {result.filename}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {result.error || 'Processing failed'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">—</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">—</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      ERROR
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">—</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function BulkResultsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BulkResultsContent />
    </Suspense>
  )
}

