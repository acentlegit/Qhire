'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'

/**
 * Bulk Resume Upload Component
 * Clean, professional ATS-standard design
 */
export default function BulkResumeUpload({ jobId, onComplete }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Upload, 2: Progress, 3: Preview, 4: Confirm
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [batchJobId, setBatchJobId] = useState(null)
  const [status, setStatus] = useState(null)
  const [results, setResults] = useState([])
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [metadata, setMetadata] = useState({ jobId: jobId || '', source: '', tags: '' })
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const statusIntervalRef = useRef(null)

  // File validation
  const validateFile = (file) => {
    const validTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
    const validExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
    const extension = '.' + file.name.split('.').pop().toLowerCase()
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (file.size > maxSize) return { valid: false, error: 'File too large (max 10MB)' }
    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return { valid: false, error: 'Invalid file type' }
    }
    return { valid: true }
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || [])
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles) => {
    const validFiles = []
    let skipped = 0

    for (const file of newFiles) {
      const validation = validateFile(file)
      if (validation.valid) {
        // Check for duplicates
        if (!files.some(f => f.name === file.name && f.size === file.size)) {
          validFiles.push(file)
        }
      } else {
        skipped++
      }
    }

    if (skipped > 0) {
      toast.error(`${skipped} file(s) skipped. Supported: PDF, DOC, DOCX, JPG, PNG (max 10MB)`)
    }

    setFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files || [])
    addFiles(droppedFiles)
  }

  const startUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    setUploading(true)
    setStep(2)

    try {
      const uploadedFiles = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        try {
          // Get upload URL
          const uploadData = await fetchJSON('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || 'application/pdf',
              size: file.size,
              entityType: 'CANDIDATE',
              entityId: 'new'
            })
          })

          const isLocalUpload = uploadData.uploadUrl.startsWith('/api/upload/local')
          
          // Upload file
          const uploadResponse = await fetch(uploadData.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: isLocalUpload ? {} : { 'Content-Type': file.type || 'application/pdf' }
          })

          if (!uploadResponse.ok) throw new Error(`Upload failed`)

          let finalUrl = isLocalUpload 
            ? `/api/upload/local?key=${encodeURIComponent(uploadData.fileKey)}&download=true`
            : uploadData.uploadUrl.split('?')[0]

          // Create attachment record
          await fetchJSON('/api/upload', {
            method: 'PUT',
            body: JSON.stringify({
              fileKey: uploadData.fileKey,
              filename: file.name,
              mimeType: file.type || 'application/pdf',
              size: file.size,
              entityType: 'CANDIDATE',
              entityId: null,
              url: finalUrl
            })
          })

          uploadedFiles.push({
            fileUrl: finalUrl,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            size: file.size
          })
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
        }
      }

      if (uploadedFiles.length === 0) {
        toast.error('No files were uploaded successfully')
        setUploading(false)
        setStep(1)
        return
      }

      // Start bulk parsing
      const parseResponse = await fetchJSON('/api/ai/bulk-parse', {
        method: 'POST',
        body: JSON.stringify({
          jobId: metadata.jobId || null,
          files: uploadedFiles,
          options: {
            autoCreateCandidates: true,
            autoMatch: !!metadata.jobId
          }
        })
      })

      setBatchJobId(parseResponse.batchJobId)
      startStatusPolling(parseResponse.batchJobId)

    } catch (error) {
      console.error('Bulk upload error:', error)
      toast.error(error.message || 'Upload failed')
      setUploading(false)
      setStep(1)
    }
  }

  const startStatusPolling = (jobId) => {
    const pollStatus = async () => {
      try {
        const statusData = await fetchJSON(`/api/ai/bulk-parse?batchJobId=${jobId}`)
        setStatus(statusData)

        if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
          clearInterval(statusIntervalRef.current)
          setUploading(false)
          
          if (statusData.results) {
            setResults(statusData.results)
            // Auto-select successful candidates
            const successful = statusData.results
              .filter(r => r.status === 'SUCCESS')
              .map(r => r.id)
            setSelectedCandidates(successful)
          }
          
          setStep(3) // Move to preview
          
          if (statusData.status === 'COMPLETED') {
            toast.success(`Processed ${statusData.processedFiles} resumes`)
          }
        }
      } catch (error) {
        console.error('Status polling error:', error)
      }
    }

    statusIntervalRef.current = setInterval(pollStatus, 2000)
    pollStatus()
  }

  const toggleCandidate = (id) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const importCandidates = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Please select at least one candidate')
      return
    }

    toast.success(`${selectedCandidates.length} candidates imported successfully!`)
    
    if (onComplete) {
      onComplete({ 
        batchJobId, 
        imported: selectedCandidates.length,
        results: results.filter(r => selectedCandidates.includes(r.id))
      })
    }

    // Navigate to results page
    router.push(`/recruiter/bulk-results?batchJobId=${batchJobId}`)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current)
      }
    }
  }, [])

  const successfulResults = results.filter(r => r.status === 'SUCCESS')
  const errorResults = results.filter(r => r.status === 'ERROR')

  return (
    <div className="space-y-6">
      {/* Step 1: Upload Area */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
              ${dragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }
            `}
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
                Drag & drop resumes here
              </p>
              <p className="text-gray-500 dark:text-gray-400 mb-4">or</p>
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Browse Files
              </button>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
                PDF, DOC, DOCX, JPG, PNG • Max 10MB per file
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* AI Badge */}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI will auto-extract candidate details
            </span>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => setFiles([])}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Clear All
                </button>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index) }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload Button */}
              <button
                onClick={startUpload}
                disabled={uploading}
                className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Upload & Process {files.length} Resume{files.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Progress */}
      {step === 2 && status && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Processing Resumes</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">AI is extracting candidate details...</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-300">{status.processedFiles || 0} of {status.totalFiles} processed</span>
              <span className="text-gray-500 dark:text-gray-400">
                {Math.round(((status.processedFiles || 0) / status.totalFiles) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((status.processedFiles || 0) / status.totalFiles) * 100}%` }}
              ></div>
            </div>
          </div>

          {status.errorFiles > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
              ⚠️ {status.errorFiles} file{status.errorFiles !== 1 ? 's' : ''} had issues
            </p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
            This may take a few minutes for large uploads
          </p>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{results.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-green-600">{successfulResults.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">With Emails</p>
              <p className="text-2xl font-bold text-blue-600">{successfulResults.filter(r => r.email).length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Errors</p>
              <p className="text-2xl font-bold text-red-600">{errorResults.length}</p>
            </div>
          </div>

          {/* Candidate Preview Cards */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Candidate Preview
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCandidates(successfulResults.map(r => r.id))}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={() => setSelectedCandidates([])}
                  className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {successfulResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    selectedCandidates.includes(result.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => toggleCandidate(result.id)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(result.id)}
                      onChange={() => toggleCandidate(result.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {result.candidate?.name || result.parsedData?.name || 'Unknown'}
                        </p>
                        {result.matchScore && result.matchScore > 0.7 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                            Top Match
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {result.email || 'No email found'}
                      </p>
                      {result.parsedData?.skills && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {result.parsedData.skills.slice(0, 5).map((skill, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {skill}
                            </span>
                          ))}
                          {result.parsedData.skills.length > 5 && (
                            <span className="text-xs text-gray-400">+{result.parsedData.skills.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{result.filename}</p>
                  </div>
                </div>
              ))}

              {/* Error Results */}
              {errorResults.length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    ⚠️ {errorResults.length} file{errorResults.length !== 1 ? 's' : ''} failed
                  </p>
                  {errorResults.map((result) => (
                    <div key={result.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{result.filename}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.error}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => { setStep(1); setFiles([]); setResults([]) }}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={importCandidates}
              disabled={selectedCandidates.length === 0}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✅ Import {selectedCandidates.length} Candidate{selectedCandidates.length !== 1 ? 's' : ''}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? 's' : ''} will be added to your pipeline
          </p>
        </div>
      )}
    </div>
  )
}
