import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { analyzeTranscription } from '../../../../lib/voice/assessment.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assessment/webhook
 * Webhook handler for voice provider callbacks
 */
export async function POST(req) {
  try {
    const data = await req.json()
    
    console.log('Assessment webhook received:', JSON.stringify(data, null, 2))

    // Determine provider from webhook data
    const isVapi = data.type?.startsWith('call.') || data.call
    const isTwilio = data.CallSid || data.AccountSid

    if (isVapi) {
      return handleVapiWebhook(data)
    } else if (isTwilio) {
      return handleTwilioWebhook(data)
    }

    // Unknown provider
    console.warn('Unknown webhook provider:', data)
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Handle Vapi webhook events
 */
async function handleVapiWebhook(data) {
  const eventType = data.type || data.event
  const callId = data.call?.id || data.id

  // Find assessment call by provider call ID
  const assessmentCall = await prisma.assessmentCall.findFirst({
    where: { providerCallId: callId },
    include: {
      candidate: true,
      application: { include: { job: true } },
    },
  })

  if (!assessmentCall) {
    console.warn('Assessment call not found for Vapi call:', callId)
    return NextResponse.json({ received: true })
  }

  switch (eventType) {
    case 'call.started':
    case 'call-start':
      await prisma.assessmentCall.update({
        where: { id: assessmentCall.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      })
      break

    case 'call.ended':
    case 'call-end':
      const callData = data.call || data
      const transcription = callData.transcript || callData.transcription || ''
      const duration = callData.duration || callData.durationSeconds || 0

      // Analyze the transcription
      let analysis = null
      if (transcription) {
        const questions = (assessmentCall.questions || []).map(q => q.question)
        analysis = await analyzeTranscription(
          transcription,
          assessmentCall.application?.job?.title || 'Position',
          questions
        )
      }

      await prisma.assessmentCall.update({
        where: { id: assessmentCall.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          duration,
          transcription,
          recordingUrl: callData.recordingUrl,
          aiAnalysis: analysis,
          score: analysis?.overallScore || null,
        },
      })
      break

    case 'call.failed':
    case 'call-error':
      await prisma.assessmentCall.update({
        where: { id: assessmentCall.id },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
        },
      })
      break

    case 'transcript':
    case 'transcription':
      // Partial transcription update
      const partialTranscript = data.transcript || data.text
      if (partialTranscript) {
        await prisma.assessmentCall.update({
          where: { id: assessmentCall.id },
          data: {
            transcription: partialTranscript,
          },
        })
      }
      break
  }

  return NextResponse.json({ received: true, event: eventType })
}

/**
 * Handle Twilio webhook events
 */
async function handleTwilioWebhook(data) {
  const callSid = data.CallSid
  const callStatus = data.CallStatus

  const assessmentCall = await prisma.assessmentCall.findFirst({
    where: { providerCallId: callSid },
  })

  if (!assessmentCall) {
    console.warn('Assessment call not found for Twilio call:', callSid)
    return NextResponse.json({ received: true })
  }

  const statusMap = {
    'initiated': 'SCHEDULED',
    'ringing': 'SCHEDULED',
    'in-progress': 'IN_PROGRESS',
    'answered': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'busy': 'FAILED',
    'no-answer': 'FAILED',
    'failed': 'FAILED',
    'canceled': 'CANCELLED',
  }

  const newStatus = statusMap[callStatus] || assessmentCall.status

  const updateData = {
    status: newStatus,
  }

  if (callStatus === 'answered' || callStatus === 'in-progress') {
    updateData.startedAt = new Date()
  }

  if (callStatus === 'completed') {
    updateData.endedAt = new Date()
    if (data.CallDuration) {
      updateData.duration = parseInt(data.CallDuration)
    }
    if (data.RecordingUrl) {
      updateData.recordingUrl = data.RecordingUrl
    }
  }

  await prisma.assessmentCall.update({
    where: { id: assessmentCall.id },
    data: updateData,
  })

  return NextResponse.json({ received: true, status: newStatus })
}

/**
 * Handle Twilio status callback
 */
export async function GET(req) {
  // Status endpoint for verification
  return NextResponse.json({
    service: 'Assessment Call Webhook',
    status: 'active',
    providers: ['vapi', 'twilio'],
  })
}

