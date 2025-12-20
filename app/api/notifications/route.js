import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { getUserNotifications, markAllAsRead, createNotification } from '../../../lib/notifications/service.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 * Get user notifications
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const result = await getUserNotifications(session.user.id, {
      limit,
      offset,
      unreadOnly,
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Notifications fetch error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * Mark all as read or create test notification
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

    const { action, title, message, type } = await req.json()

    if (action === 'markAllRead') {
      await markAllAsRead(session.user.id)
      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    // Create notification (for testing or custom notifications)
    if (title && message) {
      const notification = await createNotification({
        userId: session.user.id,
        type: type || 'system',
        title,
        message,
      })
      return NextResponse.json({ success: true, notification })
    }

    return NextResponse.json(
      createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid action'),
      { status: 400 }
    )

  } catch (error) {
    console.error('Notifications action error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

