import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth.js'
import { getAuditLogs, generateAuditReport } from '../../../lib/audit.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { prisma } from '../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audit
 * Get audit logs with filters
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

    // Only admins can view audit logs
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Only admins can view audit logs'),
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const severity = searchParams.get('severity')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const report = searchParams.get('report') === 'true'

    if (report && startDate && endDate) {
      // Generate audit report
      const auditReport = await generateAuditReport({
        startDate,
        endDate,
        userId,
        severity
      })

      return NextResponse.json({
        success: true,
        report: auditReport
      })
    }

    // Get audit logs
    const result = await getAuditLogs({
      userId,
      action,
      entityType,
      severity,
      startDate,
      endDate,
      page,
      limit
    })

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to get audit logs'),
      { status: 500 }
    )
  }
}

