import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { authOptions } from '../../../../lib/auth.js'
import { logActivity } from '../../../../lib/activity.js'

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

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        Applications: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!candidate) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(candidate)
  } catch (error) {
    console.error('Error fetching candidate:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch candidate'),
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
    
    // Get current candidate for activity log
    const currentCandidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      select: { name: true, email: true }
    })

    if (!currentCandidate) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
        { status: 404 }
      )
    }

    const candidate = await prisma.candidate.update({
      where: { id: params.id },
      data
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'CANDIDATE',
      entityId: candidate.id,
      metadata: { name: candidate.name, email: candidate.email }
    })

    return NextResponse.json(candidate)
  } catch (error) {
    console.error('Error updating candidate:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update candidate'),
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

    await prisma.candidate.delete({
      where: { id: params.id }
    })

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'CANDIDATE',
      entityId: params.id
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting candidate:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to delete candidate'),
      { status: 500 }
    )
  }
}

