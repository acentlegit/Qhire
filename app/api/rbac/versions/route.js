import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { getRBACVersions } from '../../../../lib/permissions/rbac-versioning.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rbac/versions?role=ADMIN
 * Get all versions for a role
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Admin access required'),
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')

    if (!role) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Role parameter is required'),
        { status: 400 }
      )
    }

    const versions = await getRBACVersions(role)

    return NextResponse.json({
      success: true,
      role,
      versions
    })
  } catch (error) {
    console.error('RBAC versions API error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch RBAC versions'
      ),
      { status: 500 }
    )
  }
}

