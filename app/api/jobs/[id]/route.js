import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/db.js'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { canEditJob, canDeleteJob } from '../../../../lib/permissions.js'
import { logActivity } from '../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

export async function GET(_, { params }) {
  try {
    const job = await prisma.job.findUnique({ 
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!job) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      )
    }
    
    return NextResponse.json(job)
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch job'),
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Sign in required'),
        { status: 401 }
      )
    }
    
    if (!canEditJob(session.user.role)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'You do not have permission to edit jobs'),
        { status: 403 }
      )
    }

    const data = await req.json()
    const job = await prisma.job.update({ 
      where: { id: params.id }, 
      data 
    })
    
    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'JOB',
      entityId: job.id,
      metadata: { title: job.title, status: job.status }
    })
    
    return NextResponse.json(job)
  } catch (error) {
    console.error('Error updating job:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update job'),
      { status: 500 }
    )
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Sign in required'),
        { status: 401 }
      )
    }
    
    if (!canDeleteJob(session.user.role)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'You do not have permission to delete jobs'),
        { status: 403 }
      )
    }

    await prisma.job.delete({ where: { id: params.id } })
    
    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'JOB',
      entityId: params.id
    })
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to delete job'),
      { status: 500 }
    )
  }
}

