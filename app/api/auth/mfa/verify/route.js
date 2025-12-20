import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { prisma } from '../../../../../lib/db.js'
import { verifyMFAToken, verifyBackupCode } from '../../../../../lib/auth/mfa.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { logSecurityEvent, AUDIT_ACTIONS } from '../../../../../lib/audit.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/mfa/verify
 * Verify MFA token during login
 */
export async function POST(req) {
  try {
    const { userId, token, useBackupCode = false } = await req.json()

    if (!userId || !token) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'User ID and token are required'),
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        mfaSecret: true,
        backupCodes: true
      }
    })

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'MFA is not enabled for this user'),
        { status: 404 }
      )
    }

    let isValid = false
    let remainingBackupCodes = user.backupCodes || []

    if (useBackupCode) {
      // Verify backup code
      const result = verifyBackupCode(user.backupCodes || [], token)
      isValid = result.valid
      remainingBackupCodes = result.remainingCodes

      if (isValid) {
        // Update backup codes if one was used
        await prisma.user.update({
          where: { id: user.id },
          data: {
            backupCodes: remainingBackupCodes
          }
        })
      }
    } else {
      // Verify TOTP token
      isValid = verifyMFAToken(user.mfaSecret, token)
    }

    if (!isValid) {
      // Log failed attempt
      await logSecurityEvent({
        userId: user.id,
        action: AUDIT_ACTIONS.MFA_FAILED,
        req,
        metadata: {
          useBackupCode
        },
        riskScore: 30
      })

      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Invalid MFA token'),
        { status: 401 }
      )
    }

    // Log successful verification
    await logSecurityEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.MFA_VERIFIED,
      req,
      metadata: {
        useBackupCode,
        remainingBackupCodes: remainingBackupCodes.length
      }
    })

    return NextResponse.json({
      success: true,
      verified: true,
      remainingBackupCodes: remainingBackupCodes.length
    })
  } catch (error) {
    console.error('MFA verify error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to verify MFA token'),
      { status: 500 }
    )
  }
}

