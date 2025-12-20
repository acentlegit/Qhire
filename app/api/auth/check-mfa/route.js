import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/check-mfa
 * Check if user has MFA enabled (before completing login)
 */
export async function POST(req) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Email is required'),
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        mfaEnabled: true
      }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      requiresMFA: user.mfaEnabled === true,
      userId: user.id
    })
  } catch (error) {
    console.error('Check MFA error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to check MFA status'),
      { status: 500 }
    )
  }
}

