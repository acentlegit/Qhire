import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../../lib/auth.js'
import { prisma } from '../../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../../lib/errors.js'
import { logActivity } from '../../../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/events/[eventId]/interview-notes
 * Save interview notes and transcription
 */
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { notes, transcription, duration } = await req.json()

    // Get event
    const event = await prisma.event.findUnique({
      where: { id: params.eventId }
    })

    if (!event) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Event not found'),
        { status: 404 }
      )
    }

    // Update event with interview notes
    const updatedEvent = await prisma.event.update({
      where: { id: params.eventId },
      data: {
        description: notes ? `${event.description || ''}\n\nInterview Notes:\n${notes}` : event.description,
        // Store transcription in metadata (could also create a separate table)
        attendees: transcription ? JSON.stringify({
          ...(typeof event.attendees === 'object' ? event.attendees : {}),
          transcription,
          duration,
          notesSavedAt: new Date()
        }) : event.attendees
      }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'SAVED_INTERVIEW_NOTES',
      entityType: 'EVENT',
      entityId: params.eventId,
      metadata: {
        hasNotes: !!notes,
        transcriptionLength: transcription?.length || 0,
        duration
      }
    })

    return NextResponse.json(updatedEvent)
  } catch (error) {
    console.error('Save interview notes error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to save interview notes'
      ),
      { status: 500 }
    )
  }
}

