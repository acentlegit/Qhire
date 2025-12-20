import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { cleanupExpiredSessions } from '../../../../../lib/auth/sessions.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { prisma } from '../../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/sessions/cleanup
 * Clean up expired sessions (Admin only, or can be called by cron job)
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow unauthenticated requests (for cron jobs with API key)
    const apiKey = req.headers.get('x-api-key')
    const isCronJob = apiKey === process.env.CRON_API_KEY

    if (!session && !isCronJob) {
      // Check if user is admin
      if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.FORBIDDEN, 'Admin access required or valid API key'),
          { status: 403 }
        )
      }
    }

    // Clean up expired sessions
    const cleanedCount = await cleanupExpiredSessions()

    // Also clean up sessions that haven't been active for 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const inactiveCleaned = await prisma.session.updateMany({
      where: {
        isActive: true,
        lastActivityAt: {
          lt: thirtyDaysAgo
        }
      },
      data: {
        isActive: false
      }
    })

    return NextResponse.json({
      success: true,
      expiredSessionsCleaned: cleanedCount,
      inactiveSessionsCleaned: inactiveCleaned.count,
      totalCleaned: cleanedCount + inactiveCleaned.count
    })
  } catch (error) {
    console.error('Session cleanup error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to cleanup sessions'),
      { status: 500 }
    )
  }
}

