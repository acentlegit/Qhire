import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { analyzeTranscription, getCallRecording } from '../../../../lib/voice/assessment.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assessment/analyze
 * Analyze or re-analyze assessment call transcription
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

    const { assessmentId, forceRefetch = false } = await req.json()

    if (!assessmentId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'assessmentId is required'),
        { status: 400 }
      )
    }

    const assessment = await prisma.assessmentCall.findUnique({
      where: { id: assessmentId },
      include: {
        application: {
          include: {
            job: true,
          },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Assessment call not found'),
        { status: 404 }
      )
    }

    // Get transcription
    let transcription = assessment.transcription

    // Refetch from provider if needed
    if ((!transcription || forceRefetch) && assessment.providerCallId) {
      try {
        const recording = await getCallRecording(assessment.providerCallId, assessment.provider)
        if (recording?.transcription) {
          transcription = recording.transcription
          // Update stored transcription
          await prisma.assessmentCall.update({
            where: { id: assessmentId },
            data: {
              transcription,
              recordingUrl: recording.url || assessment.recordingUrl,
            },
          })
        }
      } catch (e) {
        console.warn('Failed to fetch recording:', e.message)
      }
    }

    if (!transcription) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'No transcription available to analyze'),
        { status: 400 }
      )
    }

    // Extract questions
    const questions = (assessment.questions || []).map(q => 
      typeof q === 'string' ? q : q.question
    )

    // Analyze
    const analysis = await analyzeTranscription(
      transcription,
      assessment.application?.job?.title || 'Position',
      questions
    )

    // Update assessment with analysis
    const updated = await prisma.assessmentCall.update({
      where: { id: assessmentId },
      data: {
        aiAnalysis: analysis,
        score: analysis.overallScore,
      },
    })

    return NextResponse.json({
      success: true,
      analysis,
      assessment: updated,
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message),
      { status: 500 }
    )
  }
}

