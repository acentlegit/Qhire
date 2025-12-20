import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'
import { logActivity } from '../../../../lib/activity.js'
import { sendStatusUpdateEmail } from '../../../../lib/email.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/bulk-email
 * Send emails to multiple candidates at once (one-click email sending)
 * 
 * Request body:
 * {
 *   jobId: string (optional),
 *   candidates: [
 *     {
 *       email: string,
 *       candidateId: string (optional),
 *       name: string
 *     }
 *   ],
 *   options: {
 *     includeSchedulingLink: boolean,
 *     emailTemplate: string (optional)
 *   }
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
    const { jobId, candidates, options = {} } = data

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'candidates array is required'),
        { status: 400 }
      )
    }

    // Get job details if jobId provided
    let job = null
    if (jobId) {
      job = await prisma.job.findUnique({
        where: { id: jobId }
      })
    }

    // Generate scheduling link if requested
    let schedulingLink = null
    if (options.includeSchedulingLink) {
      // Generate a unique scheduling link (in production, use a proper scheduling service)
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      schedulingLink = `${baseUrl}/candidate/schedule?jobId=${jobId || 'general'}&token=${Date.now()}`
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    }

    // Send emails to all candidates
    for (const candidate of candidates) {
      try {
        if (!candidate.email) {
          results.failed++
          results.errors.push({ candidate: candidate.name || 'Unknown', error: 'No email address' })
          continue
        }

        // Send email
        await sendStatusUpdateEmail({
          candidateEmail: candidate.email,
          candidateName: candidate.name || 'Candidate',
          jobTitle: job?.title || 'Position',
          status: 'Applied',
          message: jobId 
            ? `We have received your application for ${job?.title || 'this position'}. We'll review it and get back to you soon.`
            : 'We have received your application. We\'ll review it and get back to you soon.'
        })

        // If scheduling link is included, send a separate email with scheduling info
        if (options.includeSchedulingLink && schedulingLink) {
          // In production, use a dedicated scheduling email template
          // For now, we'll include it in the main email or send separately
          // This would typically use a service like Calendly or custom scheduling widget
        }

        // Create application if jobId and candidateId provided
        if (jobId && candidate.candidateId) {
          // Check if application already exists
          const existingApp = await prisma.application.findFirst({
            where: {
              jobId,
              candidateId: candidate.candidateId
            }
          })

          if (!existingApp) {
            await prisma.application.create({
              data: {
                jobId,
                candidateId: candidate.candidateId,
                stage: 'Applied',
                source: 'BULK_UPLOAD'
              }
            })
          }
        }

        results.sent++

        // Log activity
        await logActivity({
          userId: session.user.id,
          action: 'CREATED',
          entityType: 'BULK_EMAIL',
          entityId: candidate.candidateId || 'unknown',
          metadata: {
            email: candidate.email,
            jobId: jobId || null,
            includeScheduling: options.includeSchedulingLink || false
          }
        })

      } catch (error) {
        console.error(`Error sending email to ${candidate.email}:`, error)
        results.failed++
        results.errors.push({
          candidate: candidate.name || candidate.email,
          error: error.message || 'Failed to send email'
        })
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: candidates.length,
      errors: results.errors,
      schedulingLink: options.includeSchedulingLink ? schedulingLink : null,
      message: `Successfully sent ${results.sent} email${results.sent !== 1 ? 's' : ''}`
    })

  } catch (error) {
    console.error('Bulk email error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to send bulk emails'
      ),
      { status: 500 }
    )
  }
}

