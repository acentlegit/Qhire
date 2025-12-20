import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { updateEventSchema } from '../../../../lib/validations.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/events/[eventId]
 * Get event details
 */
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { eventId } = params

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        application: {
          include: {
            candidate: {
              select: { id: true, name: true, email: true }
            },
            job: {
              select: { id: true, title: true, description: true }
            }
          }
        }
      }
    })

    if (!event) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Event not found'),
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: event.id,
      title: event.title,
      type: event.type,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      application: event.application
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to fetch event'),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/events/[eventId]
 * Update event (partial update)
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { eventId } = params
    const body = await req.json()

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.start && { start: new Date(body.start) }),
        ...(body.end && { end: new Date(body.end) }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.location !== undefined && { location: body.location })
      }
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to update event'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/events/[eventId]
 * Update event (full update with validation)
 */
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { eventId } = params
    const data = await req.json()
    const validation = updateEventSchema.safeParse(data)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', validation.error.errors),
        { status: 400 }
      )
    }

    const { start, end, ...updateData } = validation.data

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...updateData,
        ...(start !== undefined && { start: new Date(start) }),
        ...(end !== undefined && { end: new Date(end) })
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

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Event not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update event'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/events/[eventId]
 * Delete event
 */
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { eventId } = params

    await prisma.event.delete({
      where: { id: eventId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to delete event'),
      { status: 500 }
    )
  }
}

