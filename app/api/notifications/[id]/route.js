import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { markAsRead } from '../../../../lib/notifications/service.js'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/notifications/[id]
 * Mark notification as read
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

    const notificationId = params.id

    await markAsRead(notificationId, session.user.id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Notification update error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete notification
 */
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const notificationId = params.id

    await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Notification delete error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

