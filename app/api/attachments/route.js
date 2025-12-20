import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'

export const dynamic = 'force-dynamic'

// GET - List attachments
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    if (!entityType || !entityId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'entityType and entityId are required'),
        { status: 400 }
      )
    }

    const where = { entityType, entityId }

    const [attachments, total] = await Promise.all([
      prisma.attachment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.attachment.count({ where })
    ])

    return NextResponse.json({
      data: attachments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch attachments'),
      { status: 500 }
    )
  }
}

// POST - Create attachment record (file upload will be handled separately with S3)
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
    const { entityType, entityId, filename, mimeType, size, url } = data

    // Basic validation
    if (!entityType || !entityId || !filename || !mimeType || !size || !url) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Missing required fields'),
        { status: 400 }
      )
    }

    // Validate entityType
    const validEntityTypes = ['JOB', 'CANDIDATE', 'APPLICATION', 'OFFER', 'NOTE']
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid entityType'),
        { status: 400 }
      )
    }

    const attachment = await prisma.attachment.create({
      data: {
        entityType,
        entityId,
        filename,
        mimeType,
        size: parseInt(size),
        url,
        uploadedBy: session.user.id
      }
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error creating attachment:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to create attachment'),
      { status: 500 }
    )
  }
}

