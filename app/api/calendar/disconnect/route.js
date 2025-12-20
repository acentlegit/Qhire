import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/calendar/disconnect
 * Disconnect a calendar integration
 */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider') // GOOGLE or MICROSOFT

    if (!provider || !['GOOGLE', 'MICROSOFT'].includes(provider)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid provider'),
        { status: 400 }
      )
    }

    // Deactivate the integration
    await prisma.calendarIntegration.updateMany({
      where: {
        userId: session.user.id,
        provider: provider
      },
      data: {
        isActive: false
      }
    })

    return NextResponse.json({ success: true, message: `${provider} calendar disconnected` })
  } catch (error) {
    console.error('Calendar disconnect error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to disconnect calendar'
      ),
      { status: 500 }
    )
  }
}

/**
 * GET /api/calendar/status
 * Get calendar integration status
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

    const integrations = await prisma.calendarIntegration.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        provider: true,
        isActive: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      integrations: integrations.map(i => ({
        provider: i.provider,
        connected: i.isActive,
        connectedAt: i.createdAt
      }))
    })
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to get calendar status'
      ),
      { status: 500 }
    )
  }
}

