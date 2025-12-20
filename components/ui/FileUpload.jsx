'use client'

import { useState, useRef } from 'react'
import { fetchJSON } from '../../lib/fetch.js'
import { validateFile, formatFileSize } from '../../lib/storage.js'
import toast from 'react-hot-toast'

/**
 * File Upload Component
 * Handles file upload to S3 with progress tracking
 * 
 * @param {Object} props
 * @param {string} props.entityType - Entity type (JOB, CANDIDATE, APPLICATION, etc.)
 * @param {string} props.entityId - Entity ID (can be 'new' for new entities)
 * @param {Function} props.onUploadComplete - Callback when upload completes (receives { fileKey, url, attachmentId })
 * @param {Function} props.onUploadError - Callback on error
 * @param {Object} props.options - Upload options (maxSize, allowedTypes, etc.)
 */
export default function FileUpload({ 
  entityType, 
  entityId, 
  onUploadComplete, 
  onUploadError,
  options = {}
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateFile(file, options)
    if (!validation.valid) {
      toast.error(validation.error)
      if (onUploadError) onUploadError(new Error(validation.error))
      return
    }

    await uploadFile(file)
  }

  const uploadFile = async (file) => {
    setUploading(true)
    setProgress(0)
    setUploadedFile(null)

    try {
      // Step 1: Get upload URL from our API
      const uploadData = await fetchJSON('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          entityType,
          entityId: entityId || 'new', // Use 'new' if entity doesn't exist yet
        }),
      })

      const { uploadUrl, fileKey, entityType: returnedEntityType, entityId: returnedEntityId } = uploadData

      // Step 2: Upload file
      let finalUrl = uploadUrl
      
      // Check if this is a local upload (development mode without S3)
      if (uploadUrl.startsWith('/api/upload/local')) {
        // For local uploads, upload directly to our API
        const formData = new FormData()
        formData.append('file', file)
        formData.append('key', fileKey)
        
        const xhr = new XMLHttpRequest()
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100
            setProgress(Math.round(percentComplete))
          }
        })
        
        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText)
                finalUrl = response.url || uploadUrl
                resolve()
              } catch (e) {
                resolve() // Continue even if response parsing fails
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          })
          
          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'))
          })
          
          xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'))
          })
          
          // Upload to local endpoint
          xhr.open('PUT', uploadUrl)
          xhr.send(file)
        })
      } else {
        // For S3 uploads, use presigned URL
        const xhr = new XMLHttpRequest()

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100
            setProgress(Math.round(percentComplete))
          }
        })

        // Handle upload completion
        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          })

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'))
          })

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'))
          })

          // Start upload
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', file.type)
          xhr.send(file)
        })

        // Construct the final S3 URL
        if (uploadUrl.includes('amazonaws.com') || uploadUrl.includes('s3')) {
          // Extract the key from the presigned URL or construct S3 URL
          const urlObj = new URL(uploadUrl)
          finalUrl = `https://${urlObj.hostname}${urlObj.pathname}`
        } else if (uploadUrl.startsWith('http')) {
          // For other S3-compatible services, use the base URL
          finalUrl = uploadUrl.split('?')[0]
        }
      }
      
      const attachment = await fetchJSON('/api/upload', {
        method: 'PUT',
        body: JSON.stringify({
          fileKey,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          entityType: returnedEntityType,
          entityId: returnedEntityId,
          url: finalUrl,
        }),
      })

      setUploadedFile({
        id: attachment.id,
        filename: file.name,
        size: file.size,
        url: finalUrl,
        fileKey,
      })

      toast.success('File uploaded successfully!')
      
      if (onUploadComplete) {
        onUploadComplete({
          fileKey,
          url: finalUrl,
          attachmentId: attachment.id,
          filename: file.name,
          size: file.size,
          entityId: attachment.entityId,
          needsUpdate: attachment.needsEntityIdUpdate,
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg = error.message || 'Failed to upload file'
      toast.error(errorMsg)
      if (onUploadError) {
        onUploadError(error)
      }
    } finally {
      setUploading(false)
      setProgress(0)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {!uploadedFile ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File
          </label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <span className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 inline-block">
                {uploading ? `Uploading... ${progress}%` : 'Choose File'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
                accept={options.allowedTypes?.join(',') || '.pdf,.doc,.docx,.jpg,.jpeg,.png'}
              />
            </label>
            {uploading && (
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Max size: {options.maxSize ? formatFileSize(options.maxSize) : '10MB'}. 
            Allowed: PDF, DOC, DOCX, JPG, PNG
          </p>
        </div>
      ) : (
        <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">{uploadedFile.filename}</p>
                <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

