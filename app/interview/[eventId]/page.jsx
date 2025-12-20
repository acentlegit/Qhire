'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import AIInterviewRoom2 from '../../../components/interview/AIInterviewRoom2.jsx'
import ResumeUploadStep from '../../../components/interview/ResumeUploadStep.jsx'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'

export default function InterviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const eventId = params?.eventId

  const [eventData, setEventData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resumeUploaded, setResumeUploaded] = useState(false)
  const [interviewData, setInterviewData] = useState(null)

  useEffect(() => {
    if (status === 'authenticated' && eventId) {
      loadEventData()
    }
  }, [status, eventId])

  const loadEventData = async () => {
    try {
      setLoading(true)
      const data = await fetchJSON(`/api/events/${eventId}`)
      
      // Transform data for interview room
      setEventData({
        id: data.id,
        title: data.title,
        type: data.type,
        candidate: data.application?.candidate || { name: 'Candidate' },
        job: data.application?.job || { title: 'Interview' },
        candidateId: data.application?.candidate?.id
      })
    } catch (err) {
      console.error('Error loading event:', err)
      setError(err.message || 'Failed to load interview details')
      toast.error('Failed to load interview details')
    } finally {
      setLoading(false)
    }
  }

  const handleResumeUploaded = (data) => {
    if (data.skip) {
      // Use default questions
      setInterviewData({
        questions: [
          { question: "Tell me about yourself and your background.", category: "Introduction" },
          { question: "What interests you about this role?", category: "Motivation" },
          { question: "Describe a challenging project you worked on.", category: "Experience" },
          { question: "How do you handle tight deadlines?", category: "Problem Solving" },
          { question: "Where do you see yourself in 5 years?", category: "Goals" }
        ]
      })
    } else {
      // Use AI-generated questions from resume
      setInterviewData({
        questions: data.questions.map(q => ({
          question: typeof q === 'string' ? q : q.question,
          category: q.category || 'General'
        })),
        resumeData: data.resumeData
      })
    }
    setResumeUploaded(true)
  }

  const handleExit = () => {
    router.push('/calendar')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading interview...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin')
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Failed to Load Interview</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/calendar')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Calendar
          </button>
        </div>
      </div>
    )
  }

  // Show resume upload step first
  if (!resumeUploaded) {
    return (
      <ResumeUploadStep
        onResumeUploaded={handleResumeUploaded}
        candidateName={eventData?.candidate?.name}
        jobTitle={eventData?.job?.title}
      />
    )
  }

  // Show interview room with pre-generated questions
  return (
    <AIInterviewRoom2
      eventId={eventId}
      eventData={eventData}
      questions={interviewData?.questions}
      onExit={handleExit}
    />
  )
}
