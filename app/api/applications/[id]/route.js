import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/db.js'
import { updateApplicationSchema } from '../../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { authOptions } from '../../../../lib/auth.js'
import { logActivity } from '../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

export async function GET(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true
          }
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            skills: true
          }
        }
      }
    })

    if (!application) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Application not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch application'),
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()

    // Validate with Zod
    const validation = updateApplicationSchema.safeParse(data)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { fields: validation.error.errors }
        ),
        { status: 400 }
      )
    }

    const application = await prisma.application.update({
      where: { id: params.id },
      data: validation.data,
      include: {
        job: {
          select: {
            id: true,
            title: true
          }
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'APPLICATION',
      entityId: application.id,
      applicationId: application.id,
      metadata: { stage: application.stage }
    })
    
    return NextResponse.json(application)
  } catch (error) {
    console.error('Error updating application:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Application not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update application'),
      { status: 500 }
    )
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    await prisma.application.delete({
      where: { id: params.id }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'APPLICATION',
      entityId: params.id
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting application:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Application not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to delete application'),
      { status: 500 }
    )
  }
}

