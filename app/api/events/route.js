import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { eventSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/activity.js'
import { sendInterviewInvite } from '../../../lib/email.js'
import { syncEventToCalendars } from '../../../lib/calendar/sync.js'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const applicationId = searchParams.get('applicationId')
    const start = searchParams.get('start') // ISO date string
    const end = searchParams.get('end') // ISO date string

    const where = {}
    if (applicationId) where.applicationId = applicationId
    if (start || end) {
      // Find events that overlap with the date range
      // Event starts before range ends AND event ends after range starts
      const andConditions = []
      if (start) {
        andConditions.push({ end: { gte: new Date(start) } })
      }
      if (end) {
        andConditions.push({ start: { lte: new Date(end) } })
      }
      if (andConditions.length > 0) {
        where.AND = andConditions
      }
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { start: 'asc' },
        skip,
        take: limit,
        include: {
          application: {
            include: {
              job: { select: { title: true } },
              candidate: { select: { name: true, email: true } }
            }
          }
        }
      }),
      prisma.event.count({ where })
    ])

    return NextResponse.json({
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch events'),
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
    
    const validation = eventSchema.safeParse(data)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', validation.error.errors),
        { status: 400 }
      )
    }

    const { start, end, ...eventData } = validation.data

    const event = await prisma.event.create({
      data: {
        ...eventData,
        start: new Date(start),
        end: new Date(end),
        organizerId: eventData.organizerId || session.user.id
      },
      include: {
        application: {
          include: {
            job: { select: { title: true } },
            candidate: { select: { name: true, email: true } }
          }
        }
      }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'EVENT',
      entityId: event.id,
      applicationId: event.applicationId,
      metadata: { type: event.type, title: event.title }
    })

    // Sync to connected calendars (async, non-blocking)
    if (event.organizerId) {
      syncEventToCalendars(event.organizerId, event).catch(err => {
        console.error('Failed to sync event to calendars:', err)
        // Don't fail the request if calendar sync fails
      })
    }

    // Send interview invite email if it's an interview event
    if (event.type === 'INTERVIEW' && event.application?.candidate?.email) {
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)
      const interviewTime = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      
      sendInterviewInvite({
        candidateEmail: event.application.candidate.email,
        candidateName: event.application.candidate.name,
        jobTitle: event.application.job.title,
        interviewDate: event.start,
        interviewTime: interviewTime,
        meetingLink: event.location?.includes('http') ? event.location : null,
        location: event.location && !event.location.includes('http') ? event.location : null,
        organizerName: session.user.name || 'QHire Team'
      }).catch(err => {
        console.error('Failed to send interview invite:', err)
        // Don't fail the request if email fails
      })
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to create event'),
      { status: 500 }
    )
  }
}
