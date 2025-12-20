import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { applicationSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/activity.js'

export const dynamic = 'force-dynamic'

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
    const jobId = searchParams.get('jobId')
    const candidateId = searchParams.get('candidateId')

    const where = {}
    if (jobId) where.jobId = jobId
    if (candidateId) where.candidateId = candidateId

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          job: {
            select: {
              id: true,
              title: true,
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
      }),
      prisma.application.count({ where })
    ])

    return NextResponse.json({
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch applications'),
      { status: 500 }
    )
  }
}

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

    // Validate with Zod
    const validation = applicationSchema.safeParse(data)
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

    // Check if application already exists
    const existing = await prisma.application.findFirst({
      where: {
        jobId: validation.data.jobId,
        candidateId: validation.data.candidateId
      }
    })

    if (existing) {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.DUPLICATE,
          'Application already exists for this candidate and job',
          { jobId: validation.data.jobId, candidateId: validation.data.candidateId }
        ),
        { status: 400 }
      )
    }

          const application = await prisma.application.create({
            data: validation.data,
            include: {
              job: {
                select: {
                  id: true,
                  title: true,
                  embeddingJson: true
                }
              },
              candidate: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  embeddingJson: true
                }
              }
            }
          })

          // Auto-calculate match score if embeddings are available
          if (application.job.embeddingJson && application.candidate.embeddingJson) {
            try {
              const { calculateMatchScore } = await import('../../../lib/ai/embeddings.js')
              const matchResult = calculateMatchScore(
                application.job,
                application.candidate,
                application.job.embeddingJson,
                application.candidate.embeddingJson
              )
              
              // Update application with match score
              await prisma.application.update({
                where: { id: application.id },
                data: { matchScore: matchResult.score }
              })
              
              application.matchScore = matchResult.score
            } catch (error) {
              console.error('Error calculating match score:', error)
              // Don't fail application creation if match score calculation fails
            }
          }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'APPLICATION',
      entityId: application.id,
      applicationId: application.id,
      metadata: { jobId: application.jobId, candidateId: application.candidateId, stage: application.stage }
    })
    
    return NextResponse.json(application, { status: 201 })
  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create application'
      ),
      { status: 500 }
    )
  }
}

