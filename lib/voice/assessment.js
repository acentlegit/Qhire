/**
 * AI Voice Assessment Service
 * Handles AI-powered phone assessments using Vapi or Twilio
 */

import aiProvider from '../ai/provider.js'

// Provider configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

/**
 * Get configured voice provider
 */
export function getVoiceProvider() {
  if (VAPI_API_KEY) return 'vapi'
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) return 'twilio'
  return null
}

/**
 * Schedule an AI assessment call
 * @param {Object} options - Call options
 * @returns {Promise<Object>} Call details
 */
export async function scheduleAssessmentCall({
  phoneNumber,
  candidateName,
  jobTitle,
  questions,
  scheduledAt,
  webhookUrl,
}) {
  const provider = getVoiceProvider()

  if (!provider) {
    throw new Error('No voice provider configured. Set VAPI_API_KEY or TWILIO credentials in .env')
  }

  if (provider === 'vapi') {
    return scheduleVapiCall({
      phoneNumber,
      candidateName,
      jobTitle,
      questions,
      scheduledAt,
      webhookUrl,
    })
  } else {
    return scheduleTwilioCall({
      phoneNumber,
      candidateName,
      jobTitle,
      questions,
      scheduledAt,
      webhookUrl,
    })
  }
}

/**
 * Schedule call using Vapi
 */
async function scheduleVapiCall({
  phoneNumber,
  candidateName,
  jobTitle,
  questions,
  scheduledAt,
  webhookUrl,
}) {
  const systemPrompt = generateAssessmentPrompt(candidateName, jobTitle, questions)

  const response = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: {
        number: phoneNumber,
      },
      assistant: {
        firstMessage: `Hello ${candidateName}, this is an AI assistant calling from the hiring team for the ${jobTitle} position. Do you have a few minutes for a brief assessment?`,
        model: {
          provider: 'groq', // or 'openai'
          model: 'llama-3.1-8b-instant',
          systemPrompt,
        },
        voice: {
          provider: 'deepgram',
          voiceId: 'luna', // Friendly female voice
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
        },
        endCallMessage: 'Thank you for your time today. We will be in touch with the next steps. Goodbye!',
        maxDurationSeconds: 600, // 10 minutes
      },
      webhookUrl,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vapi API error: ${error}`)
  }

  const data = await response.json()
  return {
    provider: 'vapi',
    callId: data.id,
    status: data.status || 'scheduled',
    phoneNumber,
  }
}

/**
 * Schedule call using Twilio (with TwiML)
 */
async function scheduleTwilioCall({
  phoneNumber,
  candidateName,
  jobTitle,
  questions,
  scheduledAt,
  webhookUrl,
}) {
  // Twilio requires the twilio package to be installed
  // This is an optional integration - use Vapi instead for AI-native voice
  throw new Error(
    'Twilio integration requires additional setup. ' +
    'Install twilio package: npm install twilio, then uncomment the Twilio code. ' +
    'Alternatively, use Vapi (set VAPI_API_KEY) for AI-native voice assessments.'
  )

  /* Uncomment after installing twilio:
  const twilio = require('twilio')
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

  const call = await client.calls.create({
    to: phoneNumber,
    from: TWILIO_PHONE_NUMBER,
    url: `${webhookUrl}/twiml?name=${encodeURIComponent(candidateName)}&job=${encodeURIComponent(jobTitle)}`,
    statusCallback: `${webhookUrl}/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    record: true,
  })

  return {
    provider: 'twilio',
    callId: call.sid,
    status: call.status,
    phoneNumber,
  }
  */
}

/**
 * Generate assessment prompt for AI
 */
function generateAssessmentPrompt(candidateName, jobTitle, questions) {
  const questionsList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')

  return `You are a friendly and professional AI interviewer conducting a phone assessment for the ${jobTitle} position.

Your name is Alex from the hiring team.

CANDIDATE: ${candidateName}

IMPORTANT GUIDELINES:
- Be warm, professional, and encouraging
- Listen carefully to responses
- Ask follow-up questions when appropriate
- Keep the conversation natural
- Thank the candidate after each answer
- Do not be robotic - sound natural and conversational
- If the candidate seems nervous, reassure them

ASSESSMENT QUESTIONS (ask in order):
${questionsList}

SCORING CRITERIA:
- Relevance: How well does the answer address the question?
- Depth: Does the candidate provide specific examples?
- Communication: Is the response clear and well-articulated?
- Enthusiasm: Does the candidate show interest in the role?

After all questions:
1. Ask if they have any questions about the role
2. Thank them for their time
3. Let them know the team will review and follow up

Remember: This is a screening call, not a deep technical interview. Keep it friendly and conversational.`
}

/**
 * Get call status
 */
export async function getCallStatus(callId, provider) {
  if (provider === 'vapi') {
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    })
    return response.json()
  } else if (provider === 'twilio') {
    throw new Error('Twilio integration requires twilio package. Use Vapi instead.')
  }
  throw new Error('Unknown provider')
}

/**
 * Get call recording
 */
export async function getCallRecording(callId, provider) {
  if (provider === 'vapi') {
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    })
    const data = await response.json()
    return {
      url: data.recordingUrl,
      transcription: data.transcript,
    }
  } else if (provider === 'twilio') {
    throw new Error('Twilio integration requires twilio package. Use Vapi instead.')
  }
  return null
}

/**
 * Analyze call transcription with AI
 */
export async function analyzeTranscription(transcription, jobTitle, questions) {
  const analysisPrompt = `Analyze this interview transcription for a ${jobTitle} position.

QUESTIONS ASKED:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

TRANSCRIPTION:
${transcription}

Provide a JSON analysis with the following structure:
{
  "overallScore": (0-100),
  "summary": "Brief summary of the candidate's performance",
  "questionAnalysis": [
    {
      "question": "The question asked",
      "answer": "Candidate's answer summary",
      "score": (0-100),
      "feedback": "Specific feedback"
    }
  ],
  "strengths": ["List of strengths"],
  "areasForImprovement": ["List of areas to improve"],
  "recommendation": "PROCEED" | "MAYBE" | "REJECT",
  "recommendationReason": "Why this recommendation"
}

Return ONLY valid JSON, no other text.`

  const response = await aiProvider.chatCompletion({
    messages: [{ role: 'user', content: analysisPrompt }],
    temperature: 0.3,
    max_tokens: 2000,
  })

  try {
    const content = response.content || response.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Failed to parse AI analysis:', error)
  }

  // Return default analysis if parsing fails
  return {
    overallScore: 50,
    summary: 'Analysis could not be completed automatically. Please review the transcription manually.',
    questionAnalysis: [],
    strengths: [],
    areasForImprovement: [],
    recommendation: 'MAYBE',
    recommendationReason: 'Manual review required',
  }
}

/**
 * Generate assessment questions based on job
 */
export async function generateAssessmentQuestions(jobTitle, jobDescription, count = 5) {
  const prompt = `Generate ${count} phone screening questions for a ${jobTitle} position.

Job Description:
${jobDescription || 'General software engineering role'}

Requirements:
- Questions should be open-ended but answerable in 1-2 minutes
- Mix of behavioral and competency questions
- Suitable for initial phone screening (not deep technical)
- Professional but friendly tone

Return as a JSON array of strings (questions only).`

  const response = await aiProvider.chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
  })

  try {
    const content = response.content || response.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Failed to parse questions:', error)
  }

  // Default questions
  return [
    'Tell me about yourself and your background.',
    `What interests you about the ${jobTitle} role?`,
    'Describe a challenging project you worked on and how you handled it.',
    'How do you handle working under pressure or tight deadlines?',
    'Where do you see yourself in the next few years?',
  ]
}

