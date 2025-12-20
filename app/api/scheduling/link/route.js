import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { withRetry } from '../../../../lib/db-retry.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/scheduling/link?token=xxx
 * Get scheduling link details
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const schedulingLink = await withRetry(async () => {
      return await prisma.schedulingLink.findUnique({
        where: { token },
        include: {
          // Include related data if needed
        },
      })
    })

    if (!schedulingLink) {
      return NextResponse.json(
        { error: 'Scheduling link not found' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(schedulingLink.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Scheduling link has expired' },
        { status: 410 }
      )
    }

    // Check if active
    if (!schedulingLink.isActive) {
      return NextResponse.json(
        { error: 'Scheduling link is no longer active' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      schedulingLink: {
        id: schedulingLink.id,
        token: schedulingLink.token,
        duration: schedulingLink.duration,
        timezone: schedulingLink.timezone,
        availableSlots: schedulingLink.availableSlots || [],
        expiresAt: schedulingLink.expiresAt,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching scheduling link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduling link' },
      { status: 500 }
    )
  }
}

