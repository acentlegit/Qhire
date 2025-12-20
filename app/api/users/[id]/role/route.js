import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { authOptions } from '../../../../../lib/auth.js'
import { logActivity } from '../../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/[id]/role
 * Update user role
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    // Only admins can update roles
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Only admins can update roles'),
        { status: 403 }
      )
    }

    const { id } = params
    const { role } = await req.json()

    if (!role || !['ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(role)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid role'),
        { status: 400 }
      )
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    // Cannot demote yourself
    if (user.id === session.user.id && role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'You cannot demote yourself'),
        { status: 403 }
      )
    }

    // Cannot change Admin role (unless it's yourself staying as admin)
    if (user.role === 'ADMIN' && role !== 'ADMIN' && user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Cannot change Admin role'),
        { status: 403 }
      )
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        field: 'role',
        oldValue: user.role,
        newValue: role,
        targetUser: user.email
      }
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update role'),
      { status: 500 }
    )
  }
}

