import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { createSession } from '../../../../../lib/auth/sessions.js'
import { findOrCreateDevice } from '../../../../../lib/auth/devices.js'
import { getUserSessions } from '../../../../../lib/auth/sessions.js'
import { logAuthEvent, AUDIT_ACTIONS } from '../../../../../lib/audit.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/session/init
 * Initialize a session for the current user (called after login)
 * This creates a session and device if they don't exist
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

    // Get client info
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') ||
                     req.socket?.remoteAddress ||
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Check if user already has an active session
    const existingSessions = await getUserSessions(session.user.id)
    const hasActiveSession = existingSessions.some(s => {
      const expiresAt = new Date(s.expiresAt)
      return s.isActive && expiresAt > new Date()
    })

    // If no active session, create one
    if (!hasActiveSession) {
      // Find or create device
      const device = await findOrCreateDevice({
        userId: session.user.id,
        userAgent,
        deviceInfo: {
          screenWidth: null, // Can be passed from client if needed
          screenHeight: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: req.headers.get('accept-language')?.split(',')[0] || 'en'
        }
      })

      // Check if this is a new device (first seen = last seen means it's brand new)
      const isNewDevice = device.firstSeenAt.getTime() === device.lastSeenAt.getTime()
      
      // Send email notification for new device
      if (isNewDevice) {
        try {
          const { sendNewDeviceLoginEmail } = await import('../../../../../lib/email/security.js')
          const { prisma } = await import('../../../../../lib/db.js')
          
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { email: true, name: true }
          })
          
          if (user) {
            await sendNewDeviceLoginEmail(user.email, user.name, {
              name: device.name,
              os: device.os,
              browser: device.browser,
              ipAddress
            })
          }
        } catch (emailError) {
          console.error('Failed to send new device email:', emailError)
          // Don't throw - email failure shouldn't break session creation
        }
      }

      // Create session
      const sessionData = await createSession({
        userId: session.user.id,
        deviceId: device.id,
        ipAddress,
        userAgent,
        location: null, // Can be enhanced with geolocation API
        expiresInHours: 24
      })

      // Log successful login
      await logAuthEvent({
        userId: session.user.id,
        action: AUDIT_ACTIONS.LOGIN,
        success: true,
        req,
        metadata: {
          deviceId: device.id,
          deviceType: device.type,
          isNewDevice: device.firstSeenAt.getTime() === device.lastSeenAt.getTime()
        },
        riskScore: 10 // Low risk for normal login
      })

      return NextResponse.json({
        success: true,
        session: {
          id: sessionData.id,
          expiresAt: sessionData.expiresAt
        },
        device: {
          id: device.id,
          name: device.name,
          isTrusted: device.isTrusted
        }
      })
    }

    // Update last activity on existing session
    if (existingSessions.length > 0) {
      const { updateSessionActivity } = await import('../../../../../lib/auth/sessions.js')
      await updateSessionActivity(existingSessions[0].id)
    }

    return NextResponse.json({
      success: true,
      message: 'Session already exists'
    })
  } catch (error) {
    console.error('Session init error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to initialize session'),
      { status: 500 }
    )
  }
}

