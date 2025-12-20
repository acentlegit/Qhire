import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { AccessToken } from 'livekit-server-sdk'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { logActivity } from '../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_SECRET = process.env.LIVEKIT_SECRET
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://demo.livekit.cloud'

/**
 * GET /api/livekit/token
 * Generate LiveKit access token for video interview
 */
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
    const roomName = searchParams.get('room')
    const participantName = searchParams.get('name') || session.user.name || 'User'
    const role = searchParams.get('role') || 'participant' // participant, interviewer, candidate
    const eventId = searchParams.get('eventId')

    if (!roomName) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Room name is required'),
        { status: 400 }
      )
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_SECRET) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'LiveKit not configured'),
        { status: 500 }
      )
    }

    // Verify event exists and user has access
    if (eventId) {
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

      // Check if user is organizer, candidate, or admin
      const isOrganizer = event.organizerId === session.user.id
      const isCandidate = event.application?.candidate?.email === session.user.email
      const isAdmin = session.user.role === 'ADMIN'

      if (!isOrganizer && !isCandidate && !isAdmin) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.FORBIDDEN, 'Access denied to this interview'),
          { status: 403 }
        )
      }
    }

    // Validate credentials are present
    if (!LIVEKIT_API_KEY || !LIVEKIT_SECRET) {
      console.error('LiveKit credentials missing:', {
        hasKey: !!LIVEKIT_API_KEY,
        hasSecret: !!LIVEKIT_SECRET,
        keyLength: LIVEKIT_API_KEY?.length,
        secretLength: LIVEKIT_SECRET?.length
      })
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'LiveKit not configured'),
        { status: 500 }
      )
    }

    // Create access token - use simpler format matching working example
    // Identity should be a simple string without special characters
    const identity = `${session.user.id}-${participantName.replace(/[^a-zA-Z0-9-]/g, '-')}`
    
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
      identity: identity
    })

    // Grant permissions - simplified to match working example
    const canPublish = role !== 'viewer'
    
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish
    })

    // Generate token - toJwt() is async in newer versions
    let token
    try {
      token = await at.toJwt()
    } catch (tokenError) {
      console.error('Token generation failed:', tokenError)
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, `Token generation failed: ${tokenError.message}`),
        { status: 500 }
      )
    }
    
    // Ensure token is a string
    const tokenStr = typeof token === 'string' ? token : String(token)
    
    // Validate token format
    if (!tokenStr || tokenStr.length < 100) {
      console.error('Invalid token generated:', { 
        tokenType: typeof token,
        tokenLength: tokenStr?.length,
        tokenValue: tokenStr?.substring(0, 50)
      })
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Invalid token generated'),
        { status: 500 }
      )
    }
    
    // Log token generation for debugging
    console.log('LiveKit token generated:', {
      identity,
      room: roomName,
      role,
      hasToken: !!tokenStr,
      tokenType: typeof token,
      tokenLength: tokenStr?.length,
      hasApiKey: !!LIVEKIT_API_KEY,
      hasSecret: !!LIVEKIT_SECRET,
      keyPrefix: LIVEKIT_API_KEY?.substring(0, 5),
      url: LIVEKIT_URL
    })

    // Log interview join
    if (eventId) {
      await logActivity({
        userId: session.user.id,
        action: 'JOINED_INTERVIEW',
        entityType: 'EVENT',
        entityId: eventId,
        applicationId: eventId ? undefined : null,
        metadata: {
          room: roomName,
          role,
          platform: 'LiveKit'
        }
      })
    }

    return NextResponse.json({
      token: tokenStr,
      url: LIVEKIT_URL
    })
  } catch (error) {
    console.error('LiveKit token generation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate LiveKit token'
      ),
      { status: 500 }
    )
  }
}

