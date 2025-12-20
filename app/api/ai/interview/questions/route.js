import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import aiProvider from '../../../../../lib/ai/provider.js'
import { trackAIUsage } from '../../../../../lib/ai/usage-tracker.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/interview/questions
 * Get AI-generated interview questions for an event
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

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Event ID is required'),
        { status: 400 }
      )
    }

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        application: {
          include: {
            job: {
              select: {
                title: true,
                description: true,
                requirements: true
              }
            },
            candidate: {
              select: {
                name: true,
                skills: true,
                experience: true,
                resumeText: true
              }
            }
          }
        }
      }
    })

    if (!event) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Event not found'),
        { status: 404 }
      )
    }

    if (!event.application) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Event must be associated with an application'),
        { status: 400 }
      )
    }

    // Check if provider is configured
    const provider = process.env.AI_PROVIDER || 'openai'
    const isConfigured = (provider === 'openai' && process.env.OPENAI_API_KEY) || 
                         (provider === 'llm-core' && process.env.LLM_CORE_URL)
    
    if (!isConfigured) {
      console.warn('AI Provider not configured, returning default questions')
      // Return default questions if AI provider is not configured
      return NextResponse.json({
        questions: [
          'Tell me about yourself and your background.',
          'Why are you interested in this position?',
          'What are your greatest strengths?',
          'What is your biggest weakness?',
          'Describe a challenging project you worked on.',
          'How do you handle tight deadlines?',
          'What are your career goals?',
          'Do you have any questions for us?'
        ]
      })
    }

    // Generate AI questions based on job and candidate
    const jobTitle = event.application?.job?.title || 'Position'
    const jobDescription = event.application?.job?.description || ''
    const requirements = event.application?.job?.requirements || {}
    const candidateSkills = event.application?.candidate?.skills || ''
    const candidateExperience = event.application?.candidate?.experience || {}

    const prompt = `You are an expert technical interviewer. Generate 10 relevant interview questions for a ${jobTitle} position.

Job Description: ${jobDescription}
Job Requirements: ${JSON.stringify(requirements)}
Candidate Skills: ${candidateSkills}
Candidate Experience: ${JSON.stringify(candidateExperience)}

Generate a mix of:
- Technical questions (40%)
- Behavioral questions (30%)
- Problem-solving questions (30%)

Return only a JSON array of question strings, no other text. Example format: ["Question 1", "Question 2", ...]`

    try {
      // Get model based on provider
      const model = process.env.AI_PROVIDER === 'llm-core'
        ? (process.env.LLM_CORE_MODEL || 'llama-3-8b')
        : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo')

      const completion = await aiProvider.chatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical interviewer. Generate relevant, insightful interview questions. Always return a valid JSON array of strings.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })

      let questions = []
      try {
        const content = completion.content || '[]'
        const parsed = JSON.parse(content)
        
        // Handle different response formats
        if (Array.isArray(parsed)) {
          questions = parsed
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          questions = parsed.questions
        } else if (typeof parsed === 'string') {
          questions = [parsed]
        } else {
          // Fallback: extract questions from text
          const text = content
          questions = text.split('\n')
            .filter(line => line.trim().match(/^\d+[\.\)]/))
            .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter(q => q.length > 0)
        }
      } catch (parseErr) {
        console.error('Failed to parse AI response:', parseErr)
        // Fallback: extract questions from text
        const text = completion.content || ''
        questions = text.split('\n')
          .filter(line => line.trim().match(/^\d+[\.\)]/))
          .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(q => q.length > 0)
      }

      // Ensure we have at least some questions
      if (questions.length === 0) {
        questions = [
          'Tell me about yourself and your background.',
          'Why are you interested in this position?',
          'What are your greatest strengths?',
          'Describe a challenging project you worked on.'
        ]
      }

      // Track AI usage
      if (completion.usage && session?.user?.id) {
        await trackAIUsage({
          userId: session.user.id,
          service: 'interview',
          tokens: completion.usage.total_tokens || 0,
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
          model,
          metadata: { eventId, jobId: event.application?.jobId, provider: aiProvider.getProviderName() }
        })
      }

      return NextResponse.json({ questions: questions.slice(0, 10) })
    } catch (aiError) {
      console.error('AI API error:', aiError)
      // Return default questions on AI error
      return NextResponse.json({
        questions: [
          'Tell me about yourself and your background.',
          'Why are you interested in this position?',
          'What are your greatest strengths?',
          'What is your biggest weakness?',
          'Describe a challenging project you worked on.',
          'How do you handle tight deadlines?',
          'What are your career goals?',
          'Do you have any questions for us?'
        ]
      })
    }
  } catch (error) {
    console.error('AI interview questions error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate interview questions'
      ),
      { status: 500 }
    )
  }
}

