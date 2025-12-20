import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { getUserUsageStats, getMonthlyForecast } from '../../../../lib/ai/usage-tracker.js'
import { prisma } from '../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/usage
 * Get AI usage statistics for the current user or all users (admin only)
 * 
 * Query parameters:
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - service: 'chat' | 'resume_parse' | 'interview' | 'matching' (optional)
 * - userId: User ID (admin only, optional)
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
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')) : null
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')) : null
    const service = searchParams.get('service') || null
    const targetUserId = searchParams.get('userId') || null

    // Determine which user's data to fetch
    let userId = session.user.id

    // Admin can view other users' data
    if (targetUserId && session.user.role === 'ADMIN') {
      userId = targetUserId
    } else if (targetUserId && targetUserId !== session.user.id) {
      // Non-admin trying to access another user's data
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Access denied'),
        { status: 403 }
      )
    }

    // Get usage statistics
    const stats = await getUserUsageStats(userId, {
      startDate,
      endDate,
      service
    })

    // Get monthly forecast
    const forecast = await getMonthlyForecast(userId)

    // Get user's total cost from User model
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalAICost: true, monthlyAICost: true }
    })

    return NextResponse.json({
      success: true,
      userId,
      summary: {
        totalCost: stats.totalCost,
        monthlyCost: user?.monthlyAICost || 0,
        totalCostAllTime: user?.totalAICost || 0,
        totalTokens: stats.totalTokens,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        count: stats.count,
        monthlyForecast: forecast
      },
      byService: stats.byService,
      recentUsage: stats.usage.slice(0, 50) // Last 50 records
    })
  } catch (error) {
    console.error('AI usage API error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch usage statistics'
      ),
      { status: 500 }
    )
  }
}

