import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { withRetry } from '../../../../lib/db-retry.js'
import { logActivity } from '../../../../lib/activity.js'
import { sendInterviewInvite } from '../../../../lib/email.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/scheduling/book
 * Book an interview slot
 */
export async function POST(req) {
  try {
    const { token, start, end, candidateEmail, candidateName } = await req.json()

    if (!token || !start || !end) {
      return NextResponse.json(
        { error: 'Token, start, and end are required' },
        { status: 400 }
      )
    }

    // Get scheduling link
    const schedulingLink = await withRetry(async () => {
      return await prisma.schedulingLink.findUnique({
        where: { token },
      })
    })

    if (!schedulingLink || !schedulingLink.isActive) {
      return NextResponse.json(
        { error: 'Invalid or inactive scheduling link' },
        { status: 404 }
      )
    }

    if (new Date(schedulingLink.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Scheduling link has expired' },
        { status: 410 }
      )
    }

    // Find or create application
    let application = null
    if (schedulingLink.applicationId) {
      application = await withRetry(async () => {
        return await prisma.application.findUnique({
          where: { id: schedulingLink.applicationId },
          include: { candidate: true, job: true },
        })
      })
    } else if (schedulingLink.candidateId && schedulingLink.jobId) {
      // Find existing application or create one
      application = await withRetry(async () => {
        return await prisma.application.findFirst({
          where: {
            candidateId: schedulingLink.candidateId,
            jobId: schedulingLink.jobId,
          },
        })
      })

      if (!application) {
        application = await withRetry(async () => {
          return await prisma.application.create({
            data: {
              candidateId: schedulingLink.candidateId,
              jobId: schedulingLink.jobId,
              stage: 'Interview',
              source: 'Scheduling Link',
            },
            include: { candidate: true, job: true },
          })
        })
      }
    }

    // Create event
    const event = await withRetry(async () => {
      return await prisma.event.create({
        data: {
          applicationId: application?.id || null,
          type: 'INTERVIEW',
          title: `Interview: ${application?.candidate?.name || candidateName || 'Candidate'}`,
          description: `Interview scheduled via scheduling link`,
          start: new Date(start),
          end: new Date(end),
          timezone: schedulingLink.timezone || 'UTC',
          location: 'Virtual (Video Call)',
          organizerId: schedulingLink.createdById,
          attendees: [
            {
              email: application?.candidate?.email || candidateEmail,
              name: application?.candidate?.name || candidateName,
              role: 'Candidate',
            },
          ],
        },
        include: {
          application: {
            include: {
              candidate: true,
              job: true,
            },
          },
        },
      })
    })

    // Send interview invite email (async, non-blocking)
    const targetEmail = application?.candidate?.email || candidateEmail
    const targetName = application?.candidate?.name || candidateName || 'Candidate'
    if (targetEmail) {
      const startDate = new Date(start)
      const tz = schedulingLink.timezone || 'UTC'
      const interviewDate = startDate.toISOString()
      const interviewTime = startDate.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      sendInterviewInvite({
        candidateEmail: targetEmail,
        candidateName: targetName,
        jobTitle: application?.job?.title || 'Interview',
        interviewDate,
        interviewTime,
        meetingLink: null,
        location: event.location,
        organizerName: null
      }).catch(err => {
        console.error('Failed to send interview invite email:', err)
      })
    }

    // Update application stage if needed
    if (application && application.stage !== 'Interview') {
      await withRetry(async () => {
        return await prisma.application.update({
          where: { id: application.id },
          data: {
            stage: 'Interview',
            movedAt: new Date(),
          },
        })
      })

      await logActivity({
        userId: schedulingLink.createdById,
        action: 'MOVED',
        entityType: 'APPLICATION',
        entityId: application.id,
        applicationId: application.id,
        metadata: {
          from: application.stage,
          to: 'Interview',
        },
      })
    }

    // Deactivate scheduling link (one-time use)
    await withRetry(async () => {
      return await prisma.schedulingLink.update({
        where: { id: schedulingLink.id },
        data: { isActive: false },
      })
    })

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        start: event.start,
        end: event.end,
        title: event.title,
      },
      message: 'Interview scheduled successfully',
    }, { status: 200 })
  } catch (error) {
    console.error('Error booking interview:', error)
    return NextResponse.json(
      { error: 'Failed to book interview' },
      { status: 500 }
    )
  }
}

