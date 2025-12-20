'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../../lib/fetch.js'
import toast from 'react-hot-toast'

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']
const EXPERIENCE_LEVELS = ['ENTRY', 'MID', 'SENIOR', 'EXECUTIVE']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']

export default function JobCreate() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [msg, setMsg] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    currency: 'USD',
    employmentType: '',
    experienceLevel: '',
    requirements: '',
    benefits: '',
    status: 'OPEN'
  })

  if (status === 'loading') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  // AI JD Helper - Generate job description
  const generateJD = async () => {
    if (!formData.title) {
      toast.error('Please enter a job title first')
      return
    }

    setAiLoading(true)
    try {
      const response = await fetchJSON('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: `Generate a professional job description for: ${formData.title}. ${formData.department ? `Department: ${formData.department}.` : ''} ${formData.experienceLevel ? `Experience Level: ${formData.experienceLevel}.` : ''} Include responsibilities, requirements, and qualifications.`,
          contextType: 'JOB'
        })
      })

      if (response.content) {
        setFormData(prev => ({ ...prev, description: response.content }))
        toast.success('Job description generated!')
      }
    } catch (error) {
      console.error('AI JD generation error:', error)
      toast.error('Failed to generate job description. Please write it manually.')
    } finally {
      setAiLoading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        department: formData.department || null,
        location: formData.location || null,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : null,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : null,
        currency: formData.currency,
        employmentType: formData.employmentType || null,
        experienceLevel: formData.experienceLevel || null,
        requirements: formData.requirements ? formData.requirements.split(',').map(r => r.trim()) : null,
        benefits: formData.benefits ? formData.benefits.split(',').map(b => b.trim()) : null
      }

      await fetchJSON('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      toast.success('Job created successfully!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      const errorMsg = error.message || 'Error creating job'
      setMsg(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Job</h1>
      
      <form onSubmit={submit} className="space-y-6 bg-white rounded-lg shadow-lg p-6">
        {/* Basic Information */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Job Title *
              </label>
              <input
                type="text"
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Senior Software Engineer"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Job Description *
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={generateJD}
                  disabled={aiLoading || !formData.title}
                  className="text-sm px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading ? 'Generating...' : '🤖 AI Generate Description'}
                </button>
              </div>
              <textarea
                className="border border-gray-300 rounded-md p-2 w-full h-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Job description, responsibilities, requirements..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold mb-4">Job Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Engineering, Sales, Marketing"
                value={formData.department}
                onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., San Francisco, CA or Remote"
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Employment Type</label>
              <select
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.employmentType}
                onChange={e => setFormData(prev => ({ ...prev, employmentType: e.target.value }))}
              >
                <option value="">Select type</option>
                {EMPLOYMENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Experience Level</label>
              <select
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.experienceLevel}
                onChange={e => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
              >
                <option value="">Select level</option>
                {EXPERIENCE_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold mb-4">Compensation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Min Salary</label>
              <input
                type="number"
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 80000"
                value={formData.salaryMin}
                onChange={e => setFormData(prev => ({ ...prev, salaryMin: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Salary</label>
              <input
                type="number"
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 120000"
                value={formData.salaryMax}
                onChange={e => setFormData(prev => ({ ...prev, salaryMax: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                className="border border-gray-300 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.currency}
                onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              >
                {CURRENCIES.map(currency => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Requirements & Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Requirements (comma-separated)</label>
            <textarea
              className="border border-gray-300 rounded-md p-2 w-full h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., React, Node.js, 5+ years experience"
              value={formData.requirements}
              onChange={e => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple requirements with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Benefits (comma-separated)</label>
            <textarea
              className="border border-gray-300 rounded-md p-2 w-full h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Health Insurance, 401k, PTO, Remote Work"
              value={formData.benefits}
              onChange={e => setFormData(prev => ({ ...prev, benefits: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple benefits with commas</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Job'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        {msg && (
          <p className={`mt-2 ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {msg}
          </p>
        )}
      </form>
    </div>
  )
}
