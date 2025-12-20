import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { generateUploadUrl, validateFile } from '../../../lib/storage.js'
import { prisma } from '../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/upload
 * Generate a signed URL for file upload
 * 
 * Request body:
 * {
 *   filename: string,
 *   mimeType: string,
 *   size: number,
 *   entityType: 'JOB' | 'CANDIDATE' | 'APPLICATION' | 'OFFER' | 'NOTE',
 *   entityId: string
 * }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    const { filename, mimeType, size, entityType, entityId } = data

    // Validate required fields
    if (!filename || !mimeType || !size || !entityType || !entityId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Missing required fields'),
        { status: 400 }
      )
    }

    // Validate entity type
    const validEntityTypes = ['JOB', 'CANDIDATE', 'APPLICATION', 'OFFER', 'NOTE']
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid entityType'),
        { status: 400 }
      )
    }

    // Validate file
    const fileValidation = validateFile({ name: filename, type: mimeType, size })
    if (!fileValidation.valid) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, fileValidation.error),
        { status: 400 }
      )
    }

    // Generate upload URL
    const { uploadUrl, fileKey, expiresIn } = await generateUploadUrl(
      filename,
      mimeType,
      entityType,
      entityId
    )

    return NextResponse.json({
      uploadUrl,
      fileKey,
      expiresIn,
      // Return these so frontend can create attachment record after upload
      entityType,
      entityId
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to generate upload URL'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/upload/complete
 * Create attachment record after file is uploaded
 * 
 * Request body:
 * {
 *   fileKey: string,
 *   filename: string,
 *   mimeType: string,
 *   size: number,
 *   entityType: string,
 *   entityId: string,
 *   url: string (final S3 URL)
 * }
 */
export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    const { fileKey, filename, mimeType, size, entityType, entityId, url } = data

    // Validate required fields (entityId can be null for new entities)
    if (!fileKey || !filename || !mimeType || !size || !entityType || !url) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Missing required fields'),
        { status: 400 }
      )
    }

    // Create attachment record
    // Note: entityId can be null if entity doesn't exist yet (e.g., 'new' candidate)
    // We'll update it later when the entity is created
    const attachment = await prisma.attachment.create({
      data: {
        entityType,
        entityId: (entityId && entityId !== 'new') ? entityId : null, // Allow null for new entities
        filename,
        mimeType,
        size: parseInt(size),
        url,
        uploadedBy: session.user.id
      }
    })
    
    // If entityId was 'new', return it so frontend can update the attachment later
    return NextResponse.json({
      ...attachment,
      needsEntityIdUpdate: entityId === 'new'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating attachment:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to create attachment'),
      { status: 500 }
    )
  }
}

