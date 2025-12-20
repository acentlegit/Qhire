import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../../lib/db.js'
import { updateApplicationSchema } from '../../../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { authOptions } from '../../../../../lib/auth.js'
import { logChange } from '../../../../../lib/activity.js'
import { sendStatusUpdateEmail } from '../../../../../lib/email.js'

export const dynamic = 'force-dynamic'

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()

    // Get current application to log changes
    const currentApp = await prisma.application.findUnique({
      where: { id: params.id },
      select: { stage: true }
    })

    if (!currentApp) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Application not found'),
        { status: 404 }
      )
    }

    // Validate stage
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
      data: { 
        stage: validation.data.stage,
        movedAt: new Date()
      },
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
    await logChange({
      userId: session.user.id,
      action: 'MOVED',
      entityType: 'APPLICATION',
      entityId: application.id,
      applicationId: application.id,
      before: { stage: currentApp.stage },
      after: { stage: application.stage },
      metadata: { jobTitle: application.job.title, candidateName: application.candidate.name }
    })

    // Send email notification (async, don't wait for it)
    if (application.candidate?.email) {
      sendStatusUpdateEmail({
        candidateEmail: application.candidate.email,
        candidateName: application.candidate.name,
        jobTitle: application.job.title,
        status: application.stage,
        message: `Your application has been moved to the ${application.stage} stage.`
      }).catch(err => {
        // Email sending failed, but stage change succeeded
        // This is expected if domain is not verified - stage change still works
        if (err?.error?.statusCode === 403) {
          console.warn('⚠️ Email notification skipped (domain not verified). Stage change completed successfully.')
        } else {
          console.error('Failed to send status update email:', err)
        }
        // Don't fail the request if email fails
      })
    }

    return NextResponse.json(application)
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.NOT_FOUND,
          'Application not found'
        ),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to update application stage'
      ),
      { status: 500 }
    )
  }
}

