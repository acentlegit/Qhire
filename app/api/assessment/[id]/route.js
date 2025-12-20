import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { getCallStatus, getCallRecording, analyzeTranscription } from '../../../../lib/voice/assessment.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/assessment/[id]
 * Get assessment call details
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

    const assessmentId = params.id

    const assessment = await prisma.assessmentCall.findUnique({
      where: { id: assessmentId },
      include: {
        candidate: {
          select: { id: true, name: true, email: true, phone: true },
        },
        application: {
          include: {
            job: { select: { id: true, title: true } },
          },
        },
        event: {
          select: { id: true, title: true, start: true },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Assessment call not found'),
        { status: 404 }
      )
    }

    // If call is in progress or completed, try to get latest status
    if (assessment.providerCallId && ['IN_PROGRESS', 'SCHEDULED'].includes(assessment.status)) {
      try {
        const status = await getCallStatus(assessment.providerCallId, assessment.provider)
        // Update local status if needed
        if (status && status.status !== assessment.status) {
          await prisma.assessmentCall.update({
            where: { id: assessmentId },
            data: { status: status.status },
          })
          assessment.status = status.status
        }
      } catch (e) {
        console.warn('Failed to fetch call status:', e.message)
      }
    }

    return NextResponse.json({
      success: true,
      assessment,
    })

  } catch (error) {
    console.error('Assessment fetch error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assessment/[id]
 * Update assessment call (e.g., add manual analysis)
 */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const assessmentId = params.id
    const updates = await req.json()

    const assessment = await prisma.assessmentCall.findUnique({
      where: { id: assessmentId },
    })

    if (!assessment) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Assessment call not found'),
        { status: 404 }
      )
    }

    // Allowed updates
    const allowedFields = ['score', 'aiAnalysis', 'notes', 'status']
    const updateData = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    }

    const updated = await prisma.assessmentCall.update({
      where: { id: assessmentId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      assessment: updated,
    })

  } catch (error) {
    console.error('Assessment update error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assessment/[id]
 * Cancel or delete assessment call
 */
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const assessmentId = params.id

    const assessment = await prisma.assessmentCall.findUnique({
      where: { id: assessmentId },
    })

    if (!assessment) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Assessment call not found'),
        { status: 404 }
      )
    }

    // If scheduled, just cancel
    if (assessment.status === 'SCHEDULED') {
      await prisma.assessmentCall.update({
        where: { id: assessmentId },
        data: { status: 'CANCELLED' },
      })

      return NextResponse.json({
        success: true,
        message: 'Assessment call cancelled',
      })
    }

    // Otherwise delete
    await prisma.assessmentCall.delete({
      where: { id: assessmentId },
    })

    return NextResponse.json({
      success: true,
      message: 'Assessment call deleted',
    })

  } catch (error) {
    console.error('Assessment delete error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

