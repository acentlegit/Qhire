import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/events
 * Get calendar events (interviews)
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Build date filter
    const dateFilter = {}
    if (start) {
      dateFilter.gte = new Date(start)
    }
    if (end) {
      dateFilter.lte = new Date(end)
    }

    // Get events from database
    const events = await prisma.event.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 ? { start: dateFilter } : {}),
        // Filter by user role if needed
        ...(session.user.role !== 'ADMIN' ? {
          organizerId: session.user.id
        } : {})
      },
      include: {
        application: {
          include: {
            candidate: {
              select: { id: true, name: true, email: true }
            },
            job: {
              select: { id: true, title: true }
            }
          }
        }
      },
      orderBy: { start: 'asc' }
    })

    // Transform events for calendar
    const transformedEvents = events.map(event => ({
      id: event.id,
      title: event.title || 'Interview',
      type: event.type || 'INTERVIEW',
      startTime: event.start?.toISOString(),
      endTime: event.end?.toISOString(),
      notes: event.description,
      location: event.location,
      isVideo: true,
      candidate: event.application?.candidate || null,
      job: event.application?.job || null,
      candidateId: event.application?.candidate?.id,
      jobId: event.application?.job?.id
    }))

    return NextResponse.json({ events: transformedEvents })
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to fetch events'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/calendar/events
 * Create a new calendar event (interview)
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const body = await req.json()
    const { candidateId, jobId, type, title, startTime, endTime, notes, isVideo } = body

    if (!candidateId || !startTime) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Candidate and start time are required'),
        { status: 400 }
      )
    }

    // Find or create application for this candidate/job
    let applicationId = null
    if (jobId) {
      let application = await prisma.application.findFirst({
        where: { candidateId, jobId }
      })

      if (!application) {
        application = await prisma.application.create({
          data: {
            candidateId,
            jobId,
            status: 'SCREENING',
            source: 'DIRECT'
          }
        })
      }
      applicationId = application.id
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title: title || `${type === 'AI_INTERVIEW' ? 'AI Interview' : 'Interview'}`,
        type: type || 'INTERVIEW',
        start: new Date(startTime),
        end: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 30 * 60000),
        description: notes || null,
        applicationId,
        organizerId: session.user.id
      },
      include: {
        application: {
          include: {
            candidate: { select: { id: true, name: true, email: true } },
            job: { select: { id: true, title: true } }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        type: event.type,
        startTime: event.start?.toISOString(),
        endTime: event.end?.toISOString(),
        candidate: event.application?.candidate,
        job: event.application?.job
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to create event'),
      { status: 500 }
    )
  }
}

