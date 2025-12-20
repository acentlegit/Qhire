import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { authOptions } from '../../../../../lib/auth.js'
import bcrypt from 'bcryptjs'
import { logActivity } from '../../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/[id]/password
 * Reset user password
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

    // Only admins can reset passwords
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Only admins can reset passwords'),
        { status: 403 }
      )
    }

    const { id } = params
    const { password } = await req.json()

    if (!password || password.length < 8) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Password must be at least 8 characters'),
        { status: 400 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        field: 'password',
        targetUser: user.email,
        note: 'Password reset by admin'
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to reset password'),
      { status: 500 }
    )
  }
}

