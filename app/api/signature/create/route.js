import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { createSignatureRequest, getSignatureProvider } from '../../../../lib/signature/service.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/signature/create
 * Create a signature request for an offer
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const {
      offerId,
      signerName,
      signerEmail,
      message,
      expirationDays = 7,
    } = await req.json()

    if (!offerId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'offerId is required'),
        { status: 400 }
      )
    }

    // Get offer details
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        application: {
          include: {
            candidate: { select: { name: true, email: true } },
            job: { select: { title: true } },
          },
        },
      },
    })

    if (!offer) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Offer not found'),
        { status: 404 }
      )
    }

    // Use candidate info if not provided
    const finalSignerName = signerName || offer.application?.candidate?.name
    const finalSignerEmail = signerEmail || offer.application?.candidate?.email

    if (!finalSignerName || !finalSignerEmail) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Signer name and email are required'),
        { status: 400 }
      )
    }

    // Check if signature already exists
    const existingSignature = await prisma.signature.findFirst({
      where: {
        offerId,
        status: { in: ['PENDING', 'SIGNED'] },
      },
    })

    if (existingSignature) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'A signature request already exists for this offer'),
        { status: 400 }
      )
    }

    // Create signature request
    const result = await createSignatureRequest({
      offerId,
      signerName: finalSignerName,
      signerEmail: finalSignerEmail,
      documentUrl: offer.pdfUrl,
      expirationDays,
      message,
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: `Signature request sent to ${finalSignerEmail}`,
    })

  } catch (error) {
    console.error('Signature creation error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * GET /api/signature/create
 * Get signature configuration status
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const provider = getSignatureProvider()

    return NextResponse.json({
      provider,
      configured: true, // Custom is always available
      features: provider === 'docusign' 
        ? ['DocuSign integration', 'Legal compliance', 'Audit trail', 'Multi-party signing']
        : ['Email-based signing', 'Signature capture', 'Basic audit trail'],
      setup: provider === 'custom' ? {
        docusign: {
          required: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID'],
          description: 'DocuSign - Enterprise e-signature',
          optional: true,
        },
      } : null,
    })

  } catch (error) {
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

