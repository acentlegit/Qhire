import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'

export const dynamic = 'force-dynamic'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    const userId = searchParams.get('userId')
    const applicationId = searchParams.get('applicationId')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    const where = {}
    if (userId) where.userId = userId
    if (applicationId) where.applicationId = applicationId
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          },
          application: {
            select: {
              id: true,
              stage: true,
              job: {
                select: {
                  title: true
                }
              },
              candidate: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.activityLog.count({ where })
    ])

    return NextResponse.json({
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching activity log:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch activity log'),
      { status: 500 }
    )
  }
}
