'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'
import Link from 'next/link'

const OFFER_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED']

export default function OfferBuilder({ offerId, applicationId: initialApplicationId }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!offerId)
  const [applications, setApplications] = useState([])
  
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  
  const [formData, setFormData] = useState({
    applicationId: initialApplicationId || '',
    templateId: '',
    salary: '',
    currency: 'USD',
    startDate: '',
    benefits: '',
    terms: '',
    status: 'DRAFT'
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Fetch applications
    fetchJSON('/api/applications?limit=100')
      .then(r => setApplications(Array.isArray(r) ? r : (r.data || [])))
      .catch(err => {
        console.error('Error fetching applications:', err)
        toast.error('Failed to load applications')
      })

    // Fetch templates
    fetchJSON('/api/offer-templates')
      .then(r => {
        const tmpls = Array.isArray(r) ? r : []
        setTemplates(tmpls)
        // Auto-select default template
        const defaultTemplate = tmpls.find(t => t.isDefault) || tmpls[0]
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate)
          setFormData(prev => ({ ...prev, templateId: defaultTemplate.id }))
          updatePreview(defaultTemplate, formData)
        }
      })
      .catch(err => {
        console.error('Error fetching templates:', err)
      })

    // If editing, fetch offer data
    if (offerId) {
      fetchJSON(`/api/offers/${offerId}`)
        .then(offer => {
          setFormData({
            applicationId: offer.applicationId || '',
            templateId: offer.templateId || '',
            salary: offer.salary || '',
            currency: offer.currency || 'USD',
            startDate: offer.startDate ? new Date(offer.startDate).toISOString().split('T')[0] : '',
            benefits: offer.benefits || '',
            terms: offer.terms || '',
            status: offer.status || 'DRAFT'
          })
          setFetching(false)
        })
        .catch(err => {
          console.error('Error fetching offer:', err)
          toast.error('Failed to load offer')
          setFetching(false)
        })
    } else {
      setFetching(false)
    }
  }, [session, status, router, offerId, initialApplicationId])

  // Update preview when template or form data changes
  const updatePreview = (template, data) => {
    if (!template || !template.content) return
    
    let content = template.content
    const selectedApp = applications.find(a => a.id === data.applicationId)
    const candidate = selectedApp?.candidate
    const job = selectedApp?.job
    
    // Replace variables
    const variables = {
      '{{candidateName}}': candidate?.name || 'Candidate',
      '{{jobTitle}}': job?.title || 'Position',
      '{{salary}}': data.salary ? new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(data.salary) : 'TBD',
      '{{currency}}': data.currency,
      '{{startDate}}': data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD',
      '{{benefits}}': data.benefits || 'Standard benefits package',
      '{{terms}}': data.terms || 'Standard terms and conditions apply',
      '{{companyName}}': 'QHire' // TODO: Get from company settings
    }
    
    Object.keys(variables).forEach(key => {
      content = content.replace(new RegExp(key, 'g'), variables[key])
    })
    
    setPreviewContent(content)
  }

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t.id === templateId)
    setSelectedTemplate(template)
    setFormData(prev => ({ ...prev, templateId: templateId }))
    if (template) {
      updatePreview(template, formData)
    }
  }

  const handleFormDataChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (selectedTemplate) {
        updatePreview(selectedTemplate, updated)
      }
      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.applicationId) {
      toast.error('Please select an application')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...formData,
        salary: formData.salary ? parseInt(formData.salary) : undefined,
        startDate: formData.startDate || null
      }

      if (offerId) {
        await fetchJSON(`/api/offers/${offerId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        toast.success('Offer updated successfully')
      } else {
        await fetchJSON('/api/offers', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        toast.success('Offer created successfully')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error saving offer:', error)
      toast.error(error.message || 'Failed to save offer')
    } finally {
      setLoading(false)
    }
  }


  if (status === 'loading' || fetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const selectedApplication = applications.find(a => a.id === formData.applicationId)
  const candidateName = selectedApplication?.candidate?.name || 'N/A'
  const jobTitle = selectedApplication?.job?.title || 'N/A'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {offerId ? 'Edit Offer' : 'Create Offer'}
        </h1>
        <p className="text-gray-600">
          {selectedApplication && (
            <>For {candidateName} - {jobTitle}</>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        {/* Application Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application *
          </label>
          <select
            value={formData.applicationId}
            onChange={(e) => handleFormDataChange('applicationId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={!!offerId}
          >
            <option value="">Select an application</option>
            {applications.map(app => (
              <option key={app.id} value={app.id}>
                {app.candidate?.name || 'Unknown'} - {app.job?.title || 'Unknown Job'}
              </option>
            ))}
          </select>
        </div>

        {/* Template Selection */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Offer Template
            </label>
            <select
              value={formData.templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            {selectedTemplate?.description && (
              <p className="text-xs text-gray-500 mt-1">{selectedTemplate.description}</p>
            )}
          </div>
        )}


        {/* Salary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salary
            </label>
            <input
              type="number"
              value={formData.salary}
              onChange={(e) => handleFormDataChange('salary', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 100000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleFormDataChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleFormDataChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        {/* Benefits */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Benefits
          </label>
          <textarea
            value={formData.benefits}
            onChange={(e) => handleFormDataChange('benefits', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Health insurance, 401k, PTO, etc."
          />
        </div>

        {/* Terms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Terms & Conditions
          </label>
          <textarea
            value={formData.terms}
            onChange={(e) => handleFormDataChange('terms', e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional terms and conditions..."
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {OFFER_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Preview */}
        {previewContent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (offerId ? 'Update Offer' : 'Create Offer')}
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
