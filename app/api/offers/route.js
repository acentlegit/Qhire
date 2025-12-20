import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { offerSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/activity.js'
import { sendOfferEmail } from '../../../lib/email.js'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const applicationId = searchParams.get('applicationId')
    const status = searchParams.get('status')

    const where = {}
    if (applicationId) where.applicationId = applicationId
    if (status) where.status = status

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          application: {
            include: {
              job: { select: { title: true } },
              candidate: { select: { name: true, email: true } }
            }
          }
        }
      }),
      prisma.offer.count({ where })
    ])

    return NextResponse.json({
      data: offers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch offers'),
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    
    const validation = offerSchema.safeParse(data)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', validation.error.errors),
        { status: 400 }
      )
    }

    const { startDate, ...offerData } = validation.data

    const offer = await prisma.offer.create({
      data: {
        ...offerData,
        startDate: startDate ? new Date(startDate) : null
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

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'OFFER',
      entityId: offer.id,
      applicationId: offer.applicationId,
      metadata: { status: offer.status, salary: offer.salary }
    })

    // Send offer email if status is SENT
    if (offer.status === 'SENT' && offer.application?.candidate?.email) {
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
        // Don't fail the request if email fails
      })
    }

    return NextResponse.json(offer, { status: 201 })
  } catch (error) {
    console.error('Error creating offer:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to create offer'),
      { status: 500 }
    )
  }
}
