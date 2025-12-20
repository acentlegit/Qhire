/**
 * File Storage Utility
 * Handles file uploads to S3 or compatible storage
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET
const USE_S3 = !!(BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

/**
 * Generate a signed URL for file upload
 * @param {string} filename - Original filename
 * @param {string} mimeType - File MIME type
 * @param {string} entityType - Entity type (JOB, CANDIDATE, APPLICATION, etc.)
 * @param {string} entityId - Entity ID
 * @returns {Promise<{uploadUrl: string, fileKey: string, expiresIn: number}>}
 */
export async function generateUploadUrl(filename, mimeType, entityType, entityId) {
  const fileKey = `${entityType.toLowerCase()}/${entityId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const expiresIn = 3600 // 1 hour

  // If S3 is not configured, return a placeholder (for development)
  if (!USE_S3) {
    console.warn('⚠️  S3 not configured. Using placeholder URLs. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME in .env')
    return {
      uploadUrl: `/api/upload/local?key=${encodeURIComponent(fileKey)}`, // Local fallback
      fileKey,
      expiresIn,
    }
  }

  try {
    // Generate presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: mimeType,
      // Add metadata
      Metadata: {
        'original-filename': filename,
        'entity-type': entityType,
        'entity-id': entityId,
      },
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })

    return {
      uploadUrl,
      fileKey,
      expiresIn,
    }
  } catch (error) {
    console.error('Error generating S3 upload URL:', error)
    throw new Error('Failed to generate upload URL')
  }
}

/**
 * Generate a signed URL for file download
 * @param {string} fileKey - S3 file key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Signed download URL
 */
export async function generateDownloadUrl(fileKey, expiresIn = 3600) {
  // If S3 is not configured, return a placeholder
  if (!USE_S3) {
    console.warn('⚠️  S3 not configured. Using placeholder download URL.')
    return `/api/upload/local?key=${encodeURIComponent(fileKey)}&download=true`
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    })

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn })
    return downloadUrl
  } catch (error) {
    console.error('Error generating S3 download URL:', error)
    throw new Error('Failed to generate download URL')
  }
}

/**
 * Delete a file from storage
 * @param {string} fileKey - S3 file key
 * @returns {Promise<void>}
 */
export async function deleteFile(fileKey) {
  // If S3 is not configured, just log
  if (!USE_S3) {
    console.warn('⚠️  S3 not configured. Would delete file:', fileKey)
    return
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    })

    await s3Client.send(command)
  } catch (error) {
    console.error('Error deleting file from S3:', error)
    throw new Error('Failed to delete file')
  }
}

/**
 * Validate file
 * @param {File|Object} file - File object
 * @param {Object} options - Validation options
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'image/jpeg', 
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff'
    ],
    allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif']
  } = options

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`
    }
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    }
  }

  // Check extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!allowedExtensions.includes(`.${extension}`)) {
    return {
      valid: false,
      error: `File extension .${extension} is not allowed`
    }
  }

  return { valid: true }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

