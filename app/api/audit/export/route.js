import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audit/export
 * Export audit logs to CSV
 * 
 * Query parameters:
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - action: Action type filter (optional)
 * - entityType: Entity type filter (optional)
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

    // Only admins can export audit logs
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Admin access required'),
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')) : null
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')) : null
    const action = searchParams.get('action') || null
    const entityType = searchParams.get('entityType') || null

    // Build where clause
    const where = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }
    if (action) where.action = action
    if (entityType) where.entityType = entityType

    // Fetch audit logs
    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Convert to CSV
    const csvRows = [
      // Header row
      [
        'Timestamp',
        'User Email',
        'User Name',
        'Action',
        'Entity Type',
        'Entity ID',
        'Application ID',
        'IP Address',
        'User Agent',
        'Risk Score',
        'Severity',
        'Changes',
        'Metadata'
      ]
    ]

    // Data rows
    logs.forEach(log => {
      csvRows.push([
        log.createdAt.toISOString(),
        log.user?.email || 'System',
        log.user?.name || 'System',
        log.action,
        log.entityType || '',
        log.entityId || '',
        log.applicationId || '',
        log.ipAddress || '',
        log.userAgent || '',
        log.riskScore?.toString() || '',
        log.severity || 'LOW',
        log.changes ? JSON.stringify(log.changes) : '',
        log.metadata ? JSON.stringify(log.metadata) : ''
      ])
    })

    // Convert to CSV string
    const csv = csvRows
      .map(row => row.map(cell => {
        // Escape quotes and wrap in quotes
        const cellStr = String(cell || '')
        return `"${cellStr.replace(/"/g, '""')}"`
      }).join(','))
      .join('\n')

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Audit export error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to export audit logs'
      ),
      { status: 500 }
    )
  }
}

