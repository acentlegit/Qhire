'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'

export default function ResumeUploadStep({ onResumeUploaded, candidateName, jobTitle }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or DOCX file')
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a resume file')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    let uploadResponse = null
    let parseResponse = null

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', 'interview')

      // Upload file
      uploadResponse = await fetch('/api/upload/local', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to upload resume')
      }

      const uploadData = await uploadResponse.json()
      setUploadProgress(50)

      // Parse resume and generate questions
      parseResponse = await fetch('/api/ai/interview/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: uploadData.url,
          fileName: file.name,
          candidateName,
          jobTitle
        })
      })

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to analyze resume')
      }

      setUploadProgress(100)
      const data = await parseResponse.json()

      toast.success('Resume analyzed! Generating personalized questions...')
      
      // Call callback with parsed data and questions
      onResumeUploaded({
        resumeData: data.resumeData,
        questions: data.questions,
        fileUrl: uploadData.url
      })
    } catch (error) {
      console.error('Upload error:', error)
      
      // Get detailed error message
      let errorMessage = error.message || 'Failed to upload and analyze resume'
      
      try {
        if (uploadResponse && !uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } else if (parseResponse && !parseResponse.ok) {
          const errorData = await parseResponse.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        }
      } catch (parseError) {
        // If we can't parse error response, use the original error message
        console.error('Error parsing error response:', parseError)
      }
      
      toast.error(errorMessage)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
            <span className="text-4xl">📄</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Your Resume</h1>
          <p className="text-gray-400">
            Help us prepare personalized interview questions for you
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span>We'll analyze your resume to understand your skills and experience</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span>Generate 20 personalized questions about your projects and background</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400">✓</span>
              <span>Questions will be tailored to the <strong className="text-white">{jobTitle}</strong> role</span>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 border-2 border-dashed border-gray-600 hover:border-purple-500 transition-colors">
          {!file ? (
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">Click to upload or drag and drop</p>
              <p className="text-gray-500 text-sm mb-4">PDF, DOC, or DOCX (max 10MB)</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Choose File
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File */}
              <div className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-xl">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-gray-400 text-sm">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div>
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Analyzing resume...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!uploading && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setFile(null)}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl font-medium hover:bg-gray-700 transition-colors"
                  >
                    Change File
                  </button>
                  <button
                    onClick={handleUpload}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-lg shadow-purple-500/30"
                  >
                    Upload & Analyze
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Skip Option */}
        {!uploading && (
          <div className="text-center mt-6">
            <button
              onClick={() => onResumeUploaded({ skip: true })}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Skip and use default questions →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

