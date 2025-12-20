'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../lib/fetch.js'
import { format, formatDistanceToNow } from 'date-fns'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGES = [
  { name: 'Applied', color: 'gray', bgColor: 'bg-gray-50 dark:bg-gray-800/50', borderColor: 'border-gray-300 dark:border-gray-700' },
  { name: 'Screen', color: 'blue', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-300 dark:border-blue-700' },
  { name: 'Interview', color: 'purple', bgColor: 'bg-purple-50 dark:bg-purple-900/20', borderColor: 'border-purple-300 dark:border-purple-700' },
  { name: 'Offer', color: 'orange', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-300 dark:border-orange-700' },
  { name: 'Hired', color: 'green', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-300 dark:border-green-700' },
  { name: 'Rejected', color: 'red', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-300 dark:border-red-700' }
]

const STAGE_MAP = {
  'APPLIED': 'Applied',
  'SCREENING': 'Screen',
  'INTERVIEW': 'Interview',
  'OFFER': 'Offer',
  'HIRED': 'Hired',
  'REJECTED': 'Rejected'
}

function ApplicationCard({ application, isDragging, showAIInsights, onView, onNotes, onInterview, onReject }) {
  const router = useRouter()
  const matchScore = application.aiMatchScore || application.matchScore || null
  const candidate = application.candidate || {}
  const job = application.job || {}
  
  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const isReadOnly = application.stage === 'HIRED' || application.stage === 'REJECTED'

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-3
        shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 scale-95 shadow-xl' : ''}
        ${isReadOnly ? 'opacity-75' : ''}
      `}
    >
      {/* Avatar & Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">
            {candidate.avatarUrl ? (
              <img src={candidate.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(candidate.name)
            )}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {candidate.name || 'Unknown Candidate'}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {job.title || 'Position'}
          </p>
        </div>
      </div>

      {/* Match Score (if AI insights enabled) */}
      {showAIInsights && matchScore !== null && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">⭐ Match:</span>
            <span className={`text-xs font-bold ${
              matchScore >= 80 ? 'text-green-600 dark:text-green-400' :
              matchScore >= 60 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {matchScore}%
            </span>
            {matchScore >= 80 && (
              <span className="text-xs text-green-600 dark:text-green-400" title="Strong fit for role">
                ✓
              </span>
            )}
          </div>
        </div>
      )}

      {/* Email */}
      <div className="flex items-center gap-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="truncate">{candidate.email || 'No email'}</span>
      </div>

      {/* Applied Date */}
      {application.createdAt && (
        <div className="flex items-center gap-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Applied {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}</span>
        </div>
      )}

      {/* Stage-Specific Info */}
      {application.stage === 'INTERVIEW' && application.event && (
        <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
          <div className="flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Interview scheduled</span>
          </div>
        </div>
      )}

      {application.stage === 'OFFER' && (
        <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
          <div className="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300">
            <span>💰</span>
            <span>Offer sent</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView(application)
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNotes(application)
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Notes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onInterview(application)
            }}
            className="p-1.5 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Schedule Interview"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReject(application)
            }}
            className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Reject"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function SortableApplicationCard({ application, showAIInsights, onView, onNotes, onInterview, onReject }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: application.id,
    disabled: application.stage === 'HIRED' || application.stage === 'REJECTED'
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ApplicationCard 
        application={application} 
        isDragging={isDragging}
        showAIInsights={showAIInsights}
        onView={onView}
        onNotes={onNotes}
        onInterview={onInterview}
        onReject={onReject}
      />
    </div>
  )
}

function StageColumn({ stage, applications, totalApplications, isOver, showAIInsights, onView, onNotes, onInterview, onReject }) {
  const total = totalApplications || applications.length
  const current = applications.length
  const { setNodeRef } = useDroppable({
    id: `stage-${stage.name}`
  })

  const isReadOnly = stage.name === 'Hired' || stage.name === 'Rejected'
  
  // Get color class dynamically
  const progressColors = {
    gray: 'bg-gray-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    red: 'bg-red-500'
  }
  
  return (
    <div 
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-72 ${stage.bgColor} rounded-xl p-4 border-2 ${stage.borderColor}
        transition-all min-h-[600px]
        ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.02]' : ''}
      `}
    >
      {/* Column Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{stage.name}</h3>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {current} / {total}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${progressColors[stage.color]} rounded-full transition-all`}
            style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Applications */}
      <SortableContext 
        items={applications.map(a => a.id)} 
        strategy={verticalListSortingStrategy}
        disabled={isReadOnly}
      >
        <div className="space-y-0">
          {applications.map(application => (
            <SortableApplicationCard
              key={application.id}
              application={application}
              showAIInsights={showAIInsights}
              onView={onView}
              onNotes={onNotes}
              onInterview={onInterview}
              onReject={onReject}
            />
          ))}
          {applications.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📂</span>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                No candidates yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Drag candidates here or add new
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function PipelineBoard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobIdFromUrl = searchParams?.get('jobId')

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [selectedJob, setSelectedJob] = useState(jobIdFromUrl || '')
  const [jobs, setJobs] = useState([])
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const undoStack = useRef([])
  const undoTimeoutRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (status === 'loading') return

    fetchJSON('/api/jobs')
      .then(r => {
        const jobsData = Array.isArray(r) ? r : (r.jobs || r.data || [])
        setJobs(jobsData)
        if (jobIdFromUrl && !selectedJob) {
          setSelectedJob(jobIdFromUrl)
        }
      })
      .catch(err => {
        console.error('Error fetching jobs:', err)
      })

    fetchApplications()
  }, [status, selectedJob, jobIdFromUrl])

  function fetchApplications() {
    setLoading(true)
    const url = selectedJob 
      ? `/api/applications?jobId=${selectedJob}`
      : '/api/applications'
    
    fetchJSON(url)
      .then(response => {
        const applicationsData = Array.isArray(response) ? response : (response.applications || response.data || [])
        
        // Filter by search query
        let filtered = applicationsData
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          filtered = applicationsData.filter(app => {
            const candidate = app.candidate || {}
            const job = app.job || {}
            return (
              candidate.name?.toLowerCase().includes(query) ||
              candidate.email?.toLowerCase().includes(query) ||
              job.title?.toLowerCase().includes(query)
            )
          })
        }
        
        setApplications(filtered)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching applications:', err)
        toast.error(err.message || 'Failed to load applications')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchApplications()
  }, [searchQuery])

  function getApplicationsByStage(apps) {
    const grouped = {}
    STAGES.forEach(stage => {
      grouped[stage.name] = []
    })
    
    apps.forEach(app => {
      const stageName = STAGE_MAP[app.stage] || 'Applied'
      if (grouped[stageName]) {
        grouped[stageName].push(app)
      }
    })
    
    return grouped
  }

  function handleDragStart(event) {
    setActiveId(event.active.id)
  }

  async function handleDragEnd(event) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      setActiveId(null)
      return
    }

    const activeApplication = applications.find(a => a.id === active.id)
    if (!activeApplication) {
      setActiveId(null)
      return
    }

    // Check if dropped on a stage column
    let overStage = null
    if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
      overStage = over.id.replace('stage-', '')
    } else {
      const overApplication = applications.find(a => a.id === over.id)
      if (overApplication) {
        const stageName = STAGE_MAP[overApplication.stage] || 'Applied'
        overStage = stageName
      }
    }

    if (!overStage) {
      setActiveId(null)
      return
    }

    // Find the stage enum value
    const stageEnum = Object.keys(STAGE_MAP).find(key => STAGE_MAP[key] === overStage)
    if (!stageEnum || stageEnum === activeApplication.stage) {
      setActiveId(null)
      return
    }

    const previousStage = activeApplication.stage
    const applicationId = active.id

    // Optimistic update
    const updatedApplications = applications.map(app =>
      app.id === applicationId ? { ...app, stage: stageEnum } : app
    )
    setApplications(updatedApplications)
    setActiveId(null)

    // Save undo state
    undoStack.current.push({
      applicationId,
      previousStage,
      newStage: stageEnum
    })

    // Clear existing undo timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
    }

    try {
      await fetchJSON(`/api/applications/${applicationId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: stageEnum })
      })

      const stageName = STAGE_MAP[stageEnum] || stageEnum
      toast.success(`Candidate moved to ${stageName}`, {
        duration: 3000,
        action: {
          label: 'Undo',
          onClick: () => handleUndo()
        }
      })

      // Auto-undo after 5 seconds if not clicked
      undoTimeoutRef.current = setTimeout(() => {
        undoStack.current = []
      }, 5000)
    } catch (err) {
      console.error('Error updating stage:', err)
      toast.error('Failed to update stage')
      
      // Revert on error
      setApplications(applications)
    }
  }

  function handleUndo() {
    const lastAction = undoStack.current.pop()
    if (!lastAction) return

    const { applicationId, previousStage } = lastAction
    
    fetchJSON(`/api/applications/${applicationId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: previousStage })
    })
      .then(() => {
        fetchApplications()
        toast.success('Changes reverted')
      })
      .catch(err => {
        console.error('Error reverting:', err)
        toast.error('Failed to revert')
      })
  }

  function handleView(application) {
    router.push(`/candidate/${application.candidateId}`)
  }

  function handleNotes(application) {
    // TODO: Open notes modal
    toast('Notes feature coming soon', { icon: '📝' })
  }

  function handleInterview(application) {
    router.push(`/calendar/schedule?candidateId=${application.candidateId}&jobId=${application.jobId}`)
  }

  function handleReject(application) {
    if (!confirm(`Reject ${application.candidate?.name || 'this candidate'}?`)) return
    
    fetchJSON(`/api/applications/${application.id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'REJECTED' })
    })
      .then(() => {
        toast.success('Candidate rejected')
        fetchApplications()
      })
      .catch(err => {
        console.error('Error rejecting:', err)
        toast.error('Failed to reject candidate')
      })
  }

  const groupedApplications = getApplicationsByStage(applications)
  const totalApplications = applications.length
  const activeApplication = activeId ? applications.find(a => a.id === activeId) : null

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 -mx-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pipeline</h2>
            
            {/* Job Selector */}
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Jobs</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* AI Insights Toggle */}
            <button
              onClick={() => setShowAIInsights(!showAIInsights)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showAIInsights
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              🧠 AI Insights
            </button>

            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              ⚙️ Filters
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageApps = groupedApplications[stage.name] || []
            const isOver = false // Will be handled by drag overlay
            
            return (
              <StageColumn
                key={stage.name}
                stage={stage}
                applications={stageApps}
                totalApplications={totalApplications}
                isOver={isOver}
                showAIInsights={showAIInsights}
                onView={handleView}
                onNotes={handleNotes}
                onInterview={handleInterview}
                onReject={handleReject}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeApplication ? (
            <div className="w-72">
              <ApplicationCard 
                application={activeApplication} 
                isDragging={true}
                showAIInsights={showAIInsights}
                onView={handleView}
                onNotes={handleNotes}
                onInterview={handleInterview}
                onReject={handleReject}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
