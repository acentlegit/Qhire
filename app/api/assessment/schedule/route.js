import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { scheduleAssessmentCall, getVoiceProvider, generateAssessmentQuestions } from '../../../../lib/voice/assessment.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assessment/schedule
 * Schedule an AI assessment call for a candidate
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
      candidateId,
      applicationId,
      eventId,
      phoneNumber,
      scheduledAt,
      customQuestions,
    } = await req.json()

    if (!candidateId && !applicationId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'candidateId or applicationId is required'),
        { status: 400 }
      )
    }

    // Check if voice provider is configured
    const provider = getVoiceProvider()
    if (!provider) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'No voice provider configured',
        setup: {
          options: [
            {
              provider: 'vapi',
              name: 'Vapi.ai',
              description: 'AI-native voice agent platform',
              setup: 'Add VAPI_API_KEY to .env',
              pricing: 'Pay per minute',
              url: 'https://vapi.ai',
            },
            {
              provider: 'twilio',
              name: 'Twilio',
              description: 'Programmable voice calls',
              setup: 'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env',
              pricing: 'Pay per minute',
              url: 'https://twilio.com',
            },
          ],
        },
      }, { status: 400 })
    }

    // Fetch candidate and job details
    let candidate, job, application

    if (applicationId) {
      application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          candidate: true,
          job: true,
        },
      })
      if (!application) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.NOT_FOUND, 'Application not found'),
          { status: 404 }
        )
      }
      candidate = application.candidate
      job = application.job
    } else {
      candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
      })
      if (!candidate) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
          { status: 404 }
        )
      }
    }

    const candidatePhone = phoneNumber || candidate.phone
    if (!candidatePhone) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'No phone number available for candidate'),
        { status: 400 }
      )
    }

    // Generate or use custom questions
    let questions = customQuestions
    if (!questions || questions.length === 0) {
      questions = await generateAssessmentQuestions(
        job?.title || 'Software Engineer',
        job?.description
      )
    }

    // Get webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/assessment/webhook`

    // Schedule the call
    const callResult = await scheduleAssessmentCall({
      phoneNumber: candidatePhone,
      candidateName: candidate.name,
      jobTitle: job?.title || 'Position',
      questions,
      scheduledAt,
      webhookUrl,
    })

    // Create assessment call record
    const assessmentCall = await prisma.assessmentCall.create({
      data: {
        candidateId: candidate.id,
        applicationId: application?.id,
        eventId,
        phoneNumber: candidatePhone,
        status: scheduledAt ? 'SCHEDULED' : 'IN_PROGRESS',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        startedAt: scheduledAt ? null : new Date(),
        questions: questions.map(q => ({ question: q, answer: null, score: null })),
        provider,
        providerCallId: callResult.callId,
      },
    })

    return NextResponse.json({
      success: true,
      assessmentCall: {
        id: assessmentCall.id,
        status: assessmentCall.status,
        scheduledAt: assessmentCall.scheduledAt,
        phoneNumber: candidatePhone,
      },
      provider,
      callId: callResult.callId,
      message: scheduledAt 
        ? `Assessment call scheduled for ${new Date(scheduledAt).toLocaleString()}` 
        : 'Assessment call initiated',
    })

  } catch (error) {
    console.error('Assessment scheduling error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to schedule assessment call'
      ),
      { status: 500 }
    )
  }
}

/**
 * GET /api/assessment/schedule
 * Get assessment call configuration status
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

    const provider = getVoiceProvider()

    return NextResponse.json({
      configured: !!provider,
      provider: provider || 'none',
      features: [
        'AI-powered phone assessments',
        'Automatic call scheduling',
        'Real-time transcription',
        'AI analysis and scoring',
        'Recording storage',
      ],
      setup: !provider ? {
        vapi: {
          required: ['VAPI_API_KEY'],
          description: 'Vapi.ai - AI voice agent platform',
        },
        twilio: {
          required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
          description: 'Twilio - Programmable voice',
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

