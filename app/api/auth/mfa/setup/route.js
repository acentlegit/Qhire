import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { prisma } from '../../../../../lib/db.js'
import { generateMFASecret, generateQRCode, generateBackupCodes } from '../../../../../lib/auth/mfa.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { logSecurityEvent, AUDIT_ACTIONS } from '../../../../../lib/audit.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/mfa/setup
 * Generate MFA secret and QR code for user
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        mfaSecret: true
      }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    // If MFA is already enabled, return existing secret info (without secret)
    if (user.mfaEnabled && user.mfaSecret) {
      return NextResponse.json({
        success: true,
        mfaEnabled: true,
        message: 'MFA is already enabled'
      })
    }

    // Generate new MFA secret
    const mfaData = generateMFASecret(user)
    
    // Generate QR code
    const qrCodeUrl = await generateQRCode(mfaData.otpauthUrl)

    // Store secret temporarily (user needs to verify before enabling)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: mfaData.secret
        // Don't enable MFA yet - user must verify first
      }
    })

    // Log security event
    await logSecurityEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.MFA_ENABLED,
      req,
      metadata: {
        step: 'setup'
      }
    })

    return NextResponse.json({
      success: true,
      secret: mfaData.secret,
      qrCodeUrl,
      otpauthUrl: mfaData.otpauthUrl
    })
  } catch (error) {
    console.error('MFA setup error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to setup MFA'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/mfa/setup
 * Verify MFA token and enable MFA
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

    const { token } = await req.json()

    if (!token || token.length !== 6) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid token format'),
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        mfaSecret: true,
        mfaEnabled: true
      }
    })

    if (!user || !user.mfaSecret) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'MFA secret not found. Please setup MFA first.'),
        { status: 404 }
      )
    }

    // Verify token
    const { verifyMFAToken } = await import('../../../../../lib/auth/mfa.js')
    const isValid = verifyMFAToken(user.mfaSecret, token)

    if (!isValid) {
      // Log failed attempt
      await logSecurityEvent({
        userId: user.id,
        action: AUDIT_ACTIONS.MFA_FAILED,
        req,
        metadata: {
          step: 'verification'
        },
        riskScore: 30
      })

      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Invalid MFA token'),
        { status: 401 }
      )
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes()

    // Enable MFA and store backup codes
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        backupCodes: backupCodes,
        mfaVerifiedAt: new Date()
      }
    })

    // Log successful MFA enable
    await logSecurityEvent({
      userId: user.id,
      action: AUDIT_ACTIONS.MFA_VERIFIED,
      req,
      metadata: {
        step: 'enabled'
      }
    })

    // Send email notification
    try {
      const { sendMFAEnabledEmail } = await import('../../../../../lib/email/security.js')
      await sendMFAEnabledEmail(user.email, user.name)
    } catch (emailError) {
      console.error('Failed to send MFA enabled email:', emailError)
      // Don't throw - email failure shouldn't break MFA setup
    }

    return NextResponse.json({
      success: true,
      mfaEnabled: true,
      backupCodes, // Show backup codes only once
      message: 'MFA has been enabled successfully. Save your backup codes in a safe place.'
    })
  } catch (error) {
    console.error('MFA enable error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to enable MFA'),
      { status: 500 }
    )
  }
}

