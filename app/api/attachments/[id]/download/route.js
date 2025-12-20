import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { authOptions } from '../../../../../lib/auth.js'
import { generateDownloadUrl } from '../../../../../lib/storage.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/attachments/[id]/download
 * Get a signed download URL for an attachment
 */
export async function GET(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: params.id }
    })

    if (!attachment) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Attachment not found'),
        { status: 404 }
      )
    }

    // Extract file key from URL (or use URL directly if it's already a signed URL)
    // For now, return the URL as-is
    // In production, generate a new signed URL with expiration
    
    const downloadUrl = await generateDownloadUrl(attachment.url, 3600) // 1 hour expiry

    return NextResponse.json({
      downloadUrl,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      expiresIn: 3600
    })
  } catch (error) {
    console.error('Error generating download URL:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to generate download URL'),
      { status: 500 }
    )
  }
}

