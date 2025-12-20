import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/db.js'
import { updateOfferSchema } from '../../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { authOptions } from '../../../../lib/auth.js'
import { sendOfferEmail } from '../../../../lib/email.js'

export const dynamic = 'force-dynamic'

export async function GET(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        application: {
          include: {
            job: { select: { title: true, id: true } },
            candidate: { select: { name: true, email: true, id: true } }
          }
        }
      }
    })

    if (!offer) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Offer not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(offer)
  } catch (error) {
    console.error('Error fetching offer:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch offer'),
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    const validation = updateOfferSchema.safeParse(data)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', validation.error.errors),
        { status: 400 }
      )
    }

    const { startDate, ...updateData } = validation.data

    const offer = await prisma.offer.update({
      where: { id: params.id },
      data: {
        ...updateData,
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null })
      },
      include: {
        application: {
          include: {
            job: { select: { title: true } },
            candidate: { select: { name: true, email: true } }
          }
        }
      }
    })

    // Send offer email if status changed to SENT
    if (validation.data.status === 'SENT' && offer.application?.candidate?.email) {
      sendOfferEmail({
        candidateEmail: offer.application.candidate.email,
        candidateName: offer.application.candidate.name,
        jobTitle: offer.application.job.title,
        salary: offer.salary,
        currency: offer.currency || 'USD',
        startDate: offer.startDate,
        benefits: offer.benefits,
        offerLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/offer/${offer.id}`
      }).catch(err => {
        console.error('Failed to send offer email:', err)
      })
    }

    return NextResponse.json(offer)
  } catch (error) {
    console.error('Error updating offer:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Offer not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update offer'),
      { status: 500 }
    )
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    await prisma.offer.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting offer:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Offer not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to delete offer'),
      { status: 500 }
    )
  }
}
