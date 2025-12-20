import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { authOptions } from '../../../../../lib/auth.js'
import { logActivity } from '../../../../../lib/activity.js'
import { revokeAllUserSessions } from '../../../../../lib/auth/sessions.js'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/[id]/disable
 * Disable a user (lock account)
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    // Only admins can disable users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Only admins can disable users'),
        { status: 403 }
      )
    }

    const { id } = params

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    // Cannot disable yourself
    if (user.id === session.user.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'You cannot disable yourself'),
        { status: 403 }
      )
    }

    // Cannot disable admins
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Cannot disable Admin users'),
        { status: 403 }
      )
    }

    // Lock user (set lockedUntil to far future)
    const lockedUntil = new Date()
    lockedUntil.setFullYear(lockedUntil.getFullYear() + 100) // Lock for 100 years

    await prisma.user.update({
      where: { id },
      data: { lockedUntil }
    })

    // Revoke all active sessions
    await revokeAllUserSessions(user.id)

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        field: 'status',
        action: 'disabled',
        targetUser: user.email
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error disabling user:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to disable user'),
      { status: 500 }
    )
  }
}

