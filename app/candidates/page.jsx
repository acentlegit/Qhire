'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import DashboardLayout from '../../components/layout/DashboardLayout.jsx'

export default function CandidatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSkills, setFilterSkills] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterExperience, setFilterExperience] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchCandidates()
  }, [session, status, router, page, searchQuery, filterSkills, filterStatus, filterExperience])

  const fetchCandidates = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filterSkills && { skills: filterSkills }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterExperience && { experience: filterExperience })
      })
      
      const res = await fetchJSON(`/api/candidates?${params}`)
      const candidatesData = Array.isArray(res) ? res : (res.data || [])
      setCandidates(candidatesData)
      const totalCount = res.total || res.pagination?.total || candidatesData.length
      setTotal(totalCount)
    } catch (err) {
      console.error('Error fetching candidates:', err)
      toast.error(err.message || 'Failed to load candidates.')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterSkills('')
    setFilterStatus('')
    setFilterExperience('')
    setPage(1)
  }

  const hasActiveFilters = searchQuery || filterSkills || filterStatus || filterExperience

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Get top 3 skills
  const getTopSkills = (candidate) => {
    if (candidate.skillsParsed && Array.isArray(candidate.skillsParsed)) {
      return candidate.skillsParsed
    }
    if (candidate.skills) {
      const skills = typeof candidate.skills === 'string' 
        ? candidate.skills.split(',').map(s => s.trim())
        : []
      return skills.slice(0, 3)
    }
    return []
  }

  // Get experience display
  const getExperience = (candidate) => {
    if (candidate.yearsExperience) {
      return `${candidate.yearsExperience} yrs`
    }
    return '-'
  }

  // Get status badge
  const getStatusBadge = (candidate) => {
    if (candidate.resumeParsedAt) {
      return { label: 'Resume Parsed', color: 'blue' }
    }
    if (candidate.status === 'HIRED' || candidate.status === 'Hired') {
      return { label: 'Hired', color: 'green' }
    }
    if (candidate.status === 'REJECTED' || candidate.status === 'Rejected') {
      return { label: 'Rejected', color: 'red' }
    }
    if (candidate.status === 'INTERVIEWED' || candidate.status === 'Interviewed') {
      return { label: 'Interviewed', color: 'purple' }
    }
    if (candidate.resumeUrl) {
      return { label: 'Resume Uploaded', color: 'gray' }
    }
    return { label: 'New', color: 'gray' }
  }

  if (status === 'loading' || (loading && candidates.length === 0)) {
    return (
      <DashboardLayout title="Candidates">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Candidates">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              👥 Candidates
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your candidate database</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/candidate/create"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <span>➕</span>
              Add Candidate
            </Link>
            <button
              onClick={() => setShowBulkUpload(true)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <span>⬆</span>
              Bulk Upload
            </button>
            <Link
              href="/scraping/linkedin"
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 relative"
            >
              <span>🧠</span>
              AI Import
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search name / email"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Skills Filter */}
            <select
              value={filterSkills}
              onChange={(e) => {
                setFilterSkills(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Skills</option>
              <option value="React">React</option>
              <option value="Python">Python</option>
              <option value="Java">Java</option>
              <option value="Node.js">Node.js</option>
              <option value="AWS">AWS</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Status</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="INTERVIEWED">Interviewed</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Experience Filter */}
            <select
              value={filterExperience}
              onChange={(e) => {
                setFilterExperience(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Experience</option>
              <option value="0-2">0-2 years</option>
              <option value="3-5">3-5 years</option>
              <option value="6-10">6-10 years</option>
              <option value="10+">10+ years</option>
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Candidates Table */}
        {candidates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No candidates yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Upload resumes or add candidates manually</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowBulkUpload(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                Bulk Upload
              </button>
              <Link
                href="/candidate/create"
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Add Candidate
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Skills
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Experience
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {candidates.map((candidate) => {
                    const topSkills = getTopSkills(candidate)
                    const statusBadge = getStatusBadge(candidate)
                    const badgeColors = {
                      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
                      green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
                      red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
                      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
                      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }

                    return (
                      <tr
                        key={candidate.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {/* Candidate Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold">
                              {getInitials(candidate.name)}
                            </div>
                            <div>
                              <Link
                                href={`/candidate/${candidate.id}`}
                                className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                {candidate.name || 'N/A'}
                              </Link>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{candidate.email || 'N/A'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Skills Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {topSkills.length > 0 ? (
                              <>
                                {topSkills.slice(0, 3).map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-block text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {topSkills.length > 3 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    +{topSkills.length - 3}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </div>
                        </td>

                        {/* Experience Column */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{getExperience(candidate)}</span>
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeColors[statusBadge.color]}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/candidate/${candidate.id}`}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="View"
                            >
                              👁
                            </Link>
                            <Link
                              href={`/candidate/${candidate.id}?action=add-to-job`}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Add to Job"
                            >
                              ➕
                            </Link>
                            {candidate.resumeUrl && (
                              <a
                                href={candidate.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                title="Resume"
                              >
                                📄
                              </a>
                            )}
                            {session?.user?.role === 'ADMIN' && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Are you sure you want to archive ${candidate.name}?`)) return
                                  try {
                                    await fetchJSON(`/api/candidates/${candidate.id}`, { method: 'DELETE' })
                                    toast.success('Candidate archived')
                                    fetchCandidates()
                                  } catch (err) {
                                    toast.error(err.message || 'Failed to archive candidate')
                                  }
                                }}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Archive"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} candidates
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    ◀ Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= total}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Upload Modal (Simple) */}
        {showBulkUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkUpload(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bulk Upload Resumes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload multiple resumes at once. They will be automatically parsed and added to your candidate database.
              </p>
              <Link
                href="/recruiter/bulk-upload"
                className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-center transition-colors"
              >
                Go to Bulk Upload
              </Link>
              <button
                onClick={() => setShowBulkUpload(false)}
                className="mt-3 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
