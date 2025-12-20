'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import Link from 'next/link'
import NotesList from '../notes/NotesList'

export default function Profile({ candidateId }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [candidate, setCandidate] = useState(null)
  const [applications, setApplications] = useState([])
  const [matchScores, setMatchScores] = useState([])
  const [attachments, setAttachments] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchCandidate()
    fetchApplications()
    fetchMatchScores()
    fetchAttachments()
    fetchActivities()
  }, [session, status, router, candidateId])

  const fetchCandidate = async () => {
    setLoading(true)
    try {
      const data = await fetchJSON(`/api/candidates/${candidateId}`)
      setCandidate(data)
    } catch (error) {
      console.error('Error fetching candidate:', error)
      toast.error('Failed to load candidate')
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = async () => {
    try {
      const response = await fetchJSON(`/api/applications?candidateId=${candidateId}`)
      const apps = Array.isArray(response) ? response : (response.data || [])
      setApplications(apps)
    } catch (error) {
      console.error('Error fetching applications:', error)
    }
  }

  const fetchMatchScores = async () => {
    try {
      const response = await fetchJSON(`/api/applications?candidateId=${candidateId}`)
      const apps = Array.isArray(response) ? response : (response.data || [])
      // Get match scores from applications
      const scores = apps
        .filter(app => app.matchScore != null)
        .map(app => ({
          jobId: app.jobId,
          jobTitle: app.job?.title || 'Unknown Job',
          score: app.matchScore,
          applicationId: app.id
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Top 5 matches
      setMatchScores(scores)
    } catch (error) {
      console.error('Error fetching match scores:', error)
    }
  }

  const fetchAttachments = async () => {
    try {
      const response = await fetchJSON(`/api/attachments?entityType=CANDIDATE&entityId=${candidateId}`)
      const atts = Array.isArray(response) ? response : (response.data || [])
      setAttachments(atts)
    } catch (error) {
      console.error('Error fetching attachments:', error)
    }
  }

  const fetchActivities = async () => {
    try {
      const response = await fetchJSON(`/api/activity?entityType=CANDIDATE&entityId=${candidateId}&limit=10`)
      const acts = Array.isArray(response) ? response : (response.data || [])
      setActivities(acts)
    } catch (error) {
      console.error('Error fetching activities:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="p-6">
        <p className="text-red-600">Candidate not found</p>
      </div>
    )
  }

  const parsedSkills = candidate.skillsParsed 
    ? (typeof candidate.skillsParsed === 'string' ? JSON.parse(candidate.skillsParsed) : candidate.skillsParsed)
    : []
  const parsedExperience = candidate.experience
    ? (typeof candidate.experience === 'string' ? JSON.parse(candidate.experience) : candidate.experience)
    : []
  const parsedEducation = candidate.education
    ? (typeof candidate.education === 'string' ? JSON.parse(candidate.education) : candidate.education)
    : []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{candidate.name}</h1>
            <p className="text-gray-600 mb-4">{candidate.email}</p>
            {candidate.phone && (
              <p className="text-gray-600">{candidate.phone}</p>
            )}
          </div>
          <Link
            href={`/candidate/${candidateId}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          {parsedSkills.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {parsedSkills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {typeof skill === 'string' ? skill : skill.name || skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {parsedExperience.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Experience</h2>
              <div className="space-y-4">
                {parsedExperience.map((exp, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <div className="font-semibold">{exp.role || exp.title}</div>
                    <div className="text-gray-600">{exp.company}</div>
                    {exp.duration && (
                      <div className="text-sm text-gray-500">{exp.duration}</div>
                    )}
                    {exp.description && (
                      <div className="text-gray-700 mt-2">{exp.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {parsedEducation.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Education</h2>
              <div className="space-y-3">
                {parsedEducation.map((edu, index) => (
                  <div key={index}>
                    <div className="font-semibold">{edu.degree || edu.qualification}</div>
                    <div className="text-gray-600">{edu.institution || edu.school}</div>
                    {edu.year && (
                      <div className="text-sm text-gray-500">{edu.year}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resume Text (if parsed) */}
          {candidate.resumeText && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Resume Summary</h2>
              <p className="text-gray-700 whitespace-pre-wrap line-clamp-6">
                {candidate.resumeText}
              </p>
              {candidate.resumeUrl && (
                <Link
                  href={candidate.resumeUrl}
                  target="_blank"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                >
                  View Full Resume →
                </Link>
              )}
            </div>
          )}

          {/* Match Scores */}
          {matchScores.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Top Job Matches</h2>
              <div className="space-y-3">
                {matchScores.map((match, index) => (
                  <Link
                    key={index}
                    href={`/pipeline?jobId=${match.jobId}`}
                    className="block p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{match.jobTitle}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Application ID: {match.applicationId.slice(0, 8)}...
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          match.score >= 80 ? 'bg-green-100 text-green-800' :
                          match.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {match.score.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Attachments</h2>
              <div className="space-y-2">
                {attachments.map(att => (
                  <a
                    key={att.id}
                    href={`/api/attachments/${att.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{att.fileName}</div>
                        <div className="text-xs text-gray-500">
                          {(att.fileSize / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {activities.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {activities.map(activity => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{activity.user?.name || 'System'}</span>
                        {' '}
                        <span className="text-gray-600">{activity.action}</span>
                        {' '}
                        <span className="text-gray-600">{activity.entityType}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <NotesList candidateId={candidateId} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applications */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Applications</h2>
            {applications.length === 0 ? (
              <p className="text-gray-500 text-sm">No applications yet</p>
            ) : (
              <div className="space-y-3">
                {applications.map(app => (
                  <Link
                    key={app.id}
                    href={`/pipeline?jobId=${app.jobId}`}
                    className="block p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="font-medium text-sm">{app.job?.title || 'Unknown Job'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stage: {app.stage}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {applications.length > 0 && (
                <Link
                  href={`/offer/create?applicationId=${applications[0].id}`}
                  className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center text-sm"
                >
                  Create Offer
                </Link>
              )}
              <Link
                href={`/calendar?candidateId=${candidateId}`}
                className="block w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-center text-sm"
              >
                Schedule Interview
              </Link>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">
                  {new Date(candidate.createdAt).toLocaleDateString()}
                </span>
              </div>
              {candidate.resumeParsedAt && (
                <div>
                  <span className="text-gray-500">Resume Parsed:</span>{' '}
                  <span className="text-gray-900">
                    {new Date(candidate.resumeParsedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {candidate.resumeParseConfidence && (
                <div>
                  <span className="text-gray-500">Parse Confidence:</span>{' '}
                  <span className="text-gray-900">
                    {(candidate.resumeParseConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
