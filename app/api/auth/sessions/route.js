import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { getUserSessions, revokeSession, revokeAllUserSessions } from '../../../../lib/auth/sessions.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { logSecurityEvent, AUDIT_ACTIONS } from '../../../../lib/audit.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/sessions
 * Get all active sessions for current user
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

    const sessions = await getUserSessions(session.user.id)

    // Remove sensitive token data
    const safeSessions = sessions.map(s => ({
      id: s.id,
      device: s.device ? {
        id: s.device.id,
        name: s.device.name,
        type: s.device.type,
        os: s.device.os,
        browser: s.device.browser,
        isTrusted: s.device.isTrusted
      } : null,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      location: s.location,
      lastActivityAt: s.lastActivityAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: false // Will be set by frontend based on current session
    }))

    return NextResponse.json({
      success: true,
      sessions: safeSessions
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to get sessions'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/sessions
 * Revoke session(s)
 */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const revokeAll = searchParams.get('revokeAll') === 'true'

    if (revokeAll) {
      // Revoke all sessions except current
      await revokeAllUserSessions(session.user.id)
      
      await logSecurityEvent({
        userId: session.user.id,
        action: AUDIT_ACTIONS.SESSION_REVOKED,
        req,
        metadata: {
          type: 'all_sessions'
        }
      })

      return NextResponse.json({
        success: true,
        message: 'All other sessions have been revoked'
      })
    }

    if (!sessionId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Session ID is required'),
        { status: 400 }
      )
    }

    // Verify session belongs to user and get session info before revoking
    const { prisma } = await import('../../../../lib/db.js')
    const sessionToRevoke = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        device: true
      }
    })

    if (!sessionToRevoke || sessionToRevoke.userId !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Session not found or access denied'),
        { status: 403 }
      )
    }

    await revokeSession(sessionId)

    await logSecurityEvent({
      userId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      req,
      metadata: {
        sessionId,
        type: 'single_session'
      }
    })

    // Send email notification
    try {
      const { sendSessionRevokedEmail } = await import('../../../../lib/email/security.js')
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true }
      })

      if (user && sessionToRevoke) {
        await sendSessionRevokedEmail(user.email, user.name, {
          deviceName: sessionToRevoke.device?.name || 'Unknown Device',
          ipAddress: sessionToRevoke.ipAddress
        })
      }
    } catch (emailError) {
      console.error('Failed to send session revoked email:', emailError)
      // Don't throw - email failure shouldn't break session revocation
    }

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully'
    })
  } catch (error) {
    console.error('Revoke session error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to revoke session'),
      { status: 500 }
    )
  }
}

