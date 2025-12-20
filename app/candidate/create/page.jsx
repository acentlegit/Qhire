'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'
import FileUpload from '../../../components/ui/FileUpload.jsx'

export default function CandidateCreate() {
  const { data: session, status } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [skills, setSkills] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [candidateId, setCandidateId] = useState(null)
  const router = useRouter()

  if (status === 'loading') {
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

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      const candidate = await fetchJSON('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          skills: skills || null,
          resumeUrl: resumeUrl || null
        })
      })
      
      // Update attachment with candidate ID if resume was uploaded before candidate creation
      if (resumeAttachmentId && candidate.id) {
        try {
          await fetchJSON(`/api/attachments/${resumeAttachmentId}`, {
            method: 'PUT',
            body: JSON.stringify({ entityId: candidate.id })
          })
        } catch (err) {
          console.error('Error updating attachment entityId:', err)
          // Don't fail candidate creation if this fails
        }
      }
      
      toast.success('Candidate created successfully!')
      setName('')
      setEmail('')
      setSkills('')
      setResumeUrl('')
      setResumeAttachmentId(null)
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      const errorMsg = error.message || 'Error creating candidate'
      setMsg(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Add Candidate</h1>
      <form onSubmit={submit} className="space-y-4 bg-white rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name *</label>
          <input
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., John Doe"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Email *</label>
          <input
            type="email"
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., john.doe@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Skills (optional)</label>
          <input
            className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., React, Node.js, TypeScript"
            value={skills}
            onChange={e => setSkills(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Resume (optional)</label>
          <FileUpload
            entityType="CANDIDATE"
            entityId="new"
            onUploadComplete={(data) => {
              setResumeUrl(data.url)
              if (data.attachmentId) {
                setResumeAttachmentId(data.attachmentId)
              }
            }}
            onUploadError={(error) => {
              console.error('Upload error:', error)
            }}
            options={{
              maxSize: 10 * 1024 * 1024, // 10MB
              allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Add Candidate'}
        </button>
        {msg && (
          <p className={`mt-2 ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {msg}
          </p>
        )}
      </form>
    </div>
  )
}

