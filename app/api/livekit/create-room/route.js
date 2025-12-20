import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { RoomServiceClient } from 'livekit-server-sdk'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_SECRET = process.env.LIVEKIT_SECRET
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://demo.livekit.cloud'

/**
 * POST /api/livekit/create-room
 * Create a LiveKit room for an interview
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

    const { eventId, roomName } = await req.json()

    if (!eventId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Event ID is required'),
        { status: 400 }
      )
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_SECRET) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'LiveKit not configured'),
        { status: 500 }
      )
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        application: {
          include: {
            candidate: true,
            job: true
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

    // Generate room name if not provided
    const finalRoomName = roomName || `interview-${eventId}-${Date.now()}`

    // Create room service client
    const roomService = new RoomServiceClient(
      LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
      LIVEKIT_API_KEY,
      LIVEKIT_SECRET
    )

    // Create room
    const room = await roomService.createRoom({
      name: finalRoomName,
      emptyTimeout: 10 * 60, // 10 minutes
      maxParticipants: 10,
      metadata: JSON.stringify({
        eventId,
        type: 'interview',
        jobTitle: event.application?.job?.title,
        candidateName: event.application?.candidate?.name
      })
    })

    // Update event with room name
    await prisma.event.update({
      where: { id: eventId },
      data: {
        location: `${LIVEKIT_URL}/${finalRoomName}`
      }
    })

    return NextResponse.json({
      room: {
        name: room.name,
        sid: room.sid,
        url: `${LIVEKIT_URL}/${finalRoomName}`
      }
    })
  } catch (error) {
    console.error('LiveKit room creation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create LiveKit room'
      ),
      { status: 500 }
    )
  }
}

