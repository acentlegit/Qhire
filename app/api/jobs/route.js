import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { jobSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { canCreateJob } from '../../../lib/permissions.js'
import { logActivity } from '../../../lib/activity.js'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Cap at 100
    const skip = (page - 1) * limit

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({ 
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.job.count()
    ])

    return NextResponse.json({
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch jobs'
      ),
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    // Check authentication and permissions
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Sign in required'),
        { status: 401 }
      )
    }
    
    if (!canCreateJob(session.user.role)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'You do not have permission to create jobs'),
        { status: 403 }
      )
    }

    const data = await req.json()
    
    // Validate with Zod
    const validation = jobSchema.safeParse(data)
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

    const job = await prisma.job.create({
      data: {
        ...validation.data,
        createdById: session.user.id
      }
    })
    
    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'JOB',
      entityId: job.id,
      metadata: { title: job.title, status: job.status }
    })
    
    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Error creating job:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.DUPLICATE,
          'A job with this title already exists',
          { field: 'title' }
        ),
        { status: 400 }
      )
    }
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create job'
      ),
      { status: 500 }
    )
  }
}

