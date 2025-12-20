import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import { generateOfferLetterPDF } from '../../../../../lib/pdf/generator.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/offers/[id]/pdf
 * Generate and download offer letter PDF
 */
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const offerId = params.id

    // Fetch offer with related data
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        application: {
          include: {
            candidate: {
              select: {
                name: true,
                email: true,
              },
            },
            job: {
              select: {
                title: true,
                department: true,
              },
            },
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

    // Prepare data for PDF generation
    const pdfData = {
      // Company info (could come from settings)
      companyName: 'QHire Technologies',
      companyAddress: '123 Tech Street, San Francisco, CA 94105',
      
      // Candidate info
      candidateName: offer.application?.candidate?.name || 'Candidate',
      candidateEmail: offer.application?.candidate?.email,
      
      // Position info
      jobTitle: offer.application?.job?.title || 'Position',
      department: offer.application?.job?.department,
      employmentType: 'Full-time',
      reportingTo: 'Department Manager',
      
      // Offer details
      salary: offer.salary,
      currency: offer.currency || 'USD',
      startDate: offer.startDate,
      benefits: offer.benefits,
      terms: offer.terms,
      
      // Dates
      date: offer.createdAt,
      expiresAt: offer.expiresAt,
      
      // Signer
      signerName: session.user.name || 'HR Team',
      signerTitle: 'Human Resources',
    }

    // Generate PDF
    const pdfBuffer = await generateOfferLetterPDF(pdfData)

    // Update offer with PDF generation timestamp
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        // Could store PDF URL if saving to S3
        updatedAt: new Date(),
      },
    })

    // Return PDF as response
    const fileName = `offer-letter-${offer.application?.candidate?.name?.replace(/\s+/g, '-') || offerId}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate PDF'
      ),
      { status: 500 }
    )
  }
}

/**
 * POST /api/offers/[id]/pdf
 * Generate PDF and save to storage
 */
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const offerId = params.id
    const { saveToStorage = false } = await req.json().catch(() => ({}))

    // Fetch offer
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        application: {
          include: {
            candidate: true,
            job: true,
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

    const pdfData = {
      companyName: 'QHire Technologies',
      companyAddress: '123 Tech Street, San Francisco, CA 94105',
      candidateName: offer.application?.candidate?.name || 'Candidate',
      jobTitle: offer.application?.job?.title || 'Position',
      department: offer.application?.job?.department,
      salary: offer.salary,
      currency: offer.currency || 'USD',
      startDate: offer.startDate,
      benefits: offer.benefits,
      terms: offer.terms,
      date: offer.createdAt,
      expiresAt: offer.expiresAt,
      signerName: session.user.name || 'HR Team',
      signerTitle: 'Human Resources',
    }

    const pdfBuffer = await generateOfferLetterPDF(pdfData)

    let pdfUrl = null
    if (saveToStorage) {
      // TODO: Upload to S3 and get URL
      // pdfUrl = await uploadToS3(pdfBuffer, `offers/${offerId}/offer-letter.pdf`)
    }

    // Update offer with PDF URL
    if (pdfUrl) {
      await prisma.offer.update({
        where: { id: offerId },
        data: { pdfUrl },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'PDF generated successfully',
      pdfUrl,
      size: pdfBuffer.length,
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate PDF'
      ),
      { status: 500 }
    )
  }
}
