import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { processSignature, declineSignature, getSignatureStatus } from '../../../../lib/signature/service.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/signature/[token]
 * Get signature details by token (public - for signing page)
 */
export async function GET(req, { params }) {
  try {
    const token = params.token

    const signature = await prisma.signature.findUnique({
      where: { token },
      include: {
        offer: {
          include: {
            application: {
              include: {
                candidate: { select: { name: true } },
                job: { select: { title: true, department: true } },
              },
            },
          },
        },
      },
    })

    if (!signature) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Signature request not found'),
        { status: 404 }
      )
    }

    // Check expiration
    if (signature.status === 'PENDING' && new Date() > signature.expiresAt) {
      await prisma.signature.update({
        where: { token },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'This signing link has expired'),
        { status: 400 }
      )
    }

    // Return limited info for security
    return NextResponse.json({
      status: signature.status,
      signerName: signature.signerName,
      expiresAt: signature.expiresAt,
      signedAt: signature.signedAt,
      offer: {
        salary: signature.offer.salary,
        currency: signature.offer.currency,
        startDate: signature.offer.startDate,
        benefits: signature.offer.benefits,
        terms: signature.offer.terms,
        jobTitle: signature.offer.application?.job?.title,
        department: signature.offer.application?.job?.department,
        candidateName: signature.offer.application?.candidate?.name,
      },
    })

  } catch (error) {
    console.error('Signature fetch error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * POST /api/signature/[token]
 * Submit signature (public - for signing)
 */
export async function POST(req, { params }) {
  try {
    const token = params.token
    const { action, signatureImage, agreedToTerms } = await req.json()

    if (!action || !['sign', 'decline'].includes(action)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid action. Use "sign" or "decline"'),
        { status: 400 }
      )
    }

    // Get client IP
    const forwarded = req.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'

    if (action === 'sign') {
      if (!signatureImage) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Signature image is required'),
          { status: 400 }
        )
      }

      if (!agreedToTerms) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'You must agree to the terms'),
          { status: 400 }
        )
      }

      const result = await processSignature(token, {
        signatureImage,
        ipAddress,
      })

      return NextResponse.json({
        success: true,
        message: 'Offer letter signed successfully',
        ...result,
      })
    } else {
      const result = await declineSignature(token)

      return NextResponse.json({
        success: true,
        message: 'Offer declined',
        ...result,
      })
    }

  } catch (error) {
    console.error('Signature process error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

