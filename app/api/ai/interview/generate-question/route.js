import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import aiProvider from '../../../../../lib/ai/provider.js'
import { trackAIUsage } from '../../../../../lib/ai/usage-tracker.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/interview/generate-question
 * Generate a contextual AI question based on interview conversation
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

    const { eventId, context } = await req.json()

    // Check if provider is configured
    const provider = process.env.AI_PROVIDER || 'openai'
    const isConfigured = (provider === 'openai' && process.env.OPENAI_API_KEY) || 
                         (provider === 'llm-core' && process.env.LLM_CORE_URL)
    
    if (!isConfigured) {
      // Return a default question if AI provider is not configured
      return NextResponse.json({ 
        question: 'Could you tell me more about your experience with this technology?' 
      })
    }

    const prompt = `Based on this interview conversation context, generate a relevant follow-up question:

Context: ${context || 'Beginning of interview'}

Generate one insightful, relevant question that:
- Builds on the conversation
- Is appropriate for a technical interview
- Helps assess the candidate's skills and experience

Return only the question text, no numbering or formatting.`

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
            content: 'You are an expert interviewer. Generate relevant follow-up questions based on conversation context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      })

      const question = completion.content?.trim() || 'Could you tell me more about your experience?'
      
      // Track AI usage
      if (completion.usage && session?.user?.id) {
        await trackAIUsage({
          userId: session.user.id,
          service: 'interview',
          tokens: completion.usage.total_tokens || 0,
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
          model,
          metadata: { eventId, type: 'follow_up', provider: aiProvider.getProviderName() }
        })
      }
      
      return NextResponse.json({ question })
    } catch (aiError) {
      console.error('AI API error:', aiError)
      // Return default question on error
      return NextResponse.json({ 
        question: 'Could you tell me more about your experience with this technology?' 
      })
    }
  } catch (error) {
    console.error('AI question generation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to generate question'
      ),
      { status: 500 }
    )
  }
}

