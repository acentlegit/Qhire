import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'
import { withRetry } from '../../../../lib/db-retry.js'

export const dynamic = 'force-dynamic'

/**
 * Generate a scheduling link for candidates to pick their interview time
 * POST /api/scheduling/generate-link
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

    const { applicationId, jobId, candidateId, duration = 30, timezone = 'UTC' } = await req.json()

    if (!applicationId && !jobId && !candidateId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'applicationId, jobId, or candidateId is required'),
        { status: 400 }
      )
    }

    // Generate unique scheduling token
    const schedulingToken = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    // Create scheduling link record
    const schedulingLink = await withRetry(async () => {
      return await prisma.schedulingLink.create({
        data: {
          token: schedulingToken,
          applicationId: applicationId || null,
          jobId: jobId || null,
          candidateId: candidateId || null,
          createdById: session.user.id,
          duration: duration,
          timezone: timezone,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })
    })

    // Generate public URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const publicUrl = `${baseUrl}/schedule/${schedulingToken}`

    return NextResponse.json({
      success: true,
      schedulingLink: {
        id: schedulingLink.id,
        token: schedulingToken,
        url: publicUrl,
        expiresAt: schedulingLink.expiresAt,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('Scheduling link generation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate scheduling link'
      ),
      { status: 500 }
    )
  }
}

