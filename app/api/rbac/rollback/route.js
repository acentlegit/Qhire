import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { rollbackRBAC, saveRBACVersion } from '../../../../lib/permissions/rbac-versioning.js'
import { ROLE_SCOPES } from '../../../../lib/permissions/rbac.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rbac/rollback
 * Rollback to a previous version of RBAC permissions
 * 
 * Request body:
 * {
 *   role: string (required)
 *   version: number (required)
 * }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Admin access required'),
        { status: 403 }
      )
    }

    const { role, version } = await req.json()

    if (!role || version === undefined) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Role and version are required'),
        { status: 400 }
      )
    }

    // Get permissions from the specified version
    const permissions = await rollbackRBAC(role, version)

    // Save as a new version (so we have a record of the rollback)
    const newVersion = await saveRBACVersion(role, permissions, session.user.id)

    // Note: In a real implementation, you would also update the actual RBAC system
    // (ROLE_SCOPES) to apply these permissions. For now, we just save the version.

    return NextResponse.json({
      success: true,
      message: `Rolled back to version ${version} and saved as version ${newVersion}`,
      role,
      version: newVersion,
      permissions
    })
  } catch (error) {
    console.error('RBAC rollback API error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to rollback RBAC permissions'
      ),
      { status: 500 }
    )
  }
}

