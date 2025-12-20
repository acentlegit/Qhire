import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { prisma } from '../../../../../lib/db.js'
import { verifyMFAToken } from '../../../../../lib/auth/mfa.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { logSecurityEvent, AUDIT_ACTIONS } from '../../../../../lib/audit.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/mfa/disable
 * Disable MFA for user (requires MFA token to confirm)
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { token, password } = await req.json()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        mfaSecret: true,
        password: true
      }
    })

    if (!user || !user.mfaEnabled) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'MFA is not enabled'),
        { status: 404 }
      )
    }

    // Verify MFA token before disabling
    if (token) {
      const isValid = verifyMFAToken(user.mfaSecret, token)
      if (!isValid) {
        await logSecurityEvent({
          userId: user.id,
          action: AUDIT_ACTIONS.MFA_FAILED,
          req,
          metadata: {
            step: 'disable_attempt'
          },
          riskScore: 50
        })

        return NextResponse.json(
          createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Invalid MFA token'),
          { status: 401 }
        )
      }
    } else {
      // Require either MFA token or password
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'MFA token is required to disable MFA'),
        { status: 400 }
      )
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        backupCodes: null,
        mfaVerifiedAt: null
      }
    })

    // Log security event
    await logSecurityEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.MFA_DISABLED,
      req,
      metadata: {
        method: 'token_verification'
      },
      riskScore: 20
    })

    return NextResponse.json({
      success: true,
      mfaEnabled: false,
      message: 'MFA has been disabled successfully'
    })
  } catch (error) {
    console.error('MFA disable error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to disable MFA'),
      { status: 500 }
    )
  }
}

