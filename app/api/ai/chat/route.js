import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { processChatMessage, getChatHistoryForUser, clearChatHistory } from '../../../../lib/ai/chat.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/chat
 * Send a chat message to the AI assistant
 * 
 * Request body:
 * {
 *   message: string (required)
 *   entityType?: string (optional, 'JOB', 'CANDIDATE', 'APPLICATION')
 *   entityId?: string (optional)
 * }
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

    const data = await req.json()
    const { message, entityType, entityId } = data

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Message is required'),
        { status: 400 }
      )
    }

    const response = await processChatMessage(
      session.user.id,
      message.trim(),
      entityType || null,
      entityId || null
    )

    return NextResponse.json({
      message: response.message,
      entityType: response.entityType,
      entityId: response.entityId
    })
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error stack:', error.stack)
    
    // Check for specific error types
    let errorMessage = error.message || 'Failed to process chat message'
    let statusCode = 500
    
    // Connection errors (LLM Core Services not reachable)
    if (errorMessage.includes('Cannot connect to LLM Core Services') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND')) {
      const provider = process.env.AI_PROVIDER || 'openai'
      if (provider === 'llm-core') {
        errorMessage = `Cannot connect to LLM Core Services.\n\n` +
          `Please check:\n` +
          `1. LLM_CORE_URL is correct in .env (currently: ${process.env.LLM_CORE_URL || 'not set'})\n` +
          `2. LLM Core Services is running\n` +
          `3. Network connectivity\n\n` +
          `To use OpenAI instead, set in .env:\n` +
          `AI_PROVIDER=openai\n` +
          `OPENAI_API_KEY=sk-your-key-here`
      } else {
        errorMessage = 'Cannot connect to OpenAI API. Please check your internet connection and API key.'
      }
      statusCode = 503 // Service Unavailable
    } else if (errorMessage.includes('OpenAI API key not configured') || errorMessage.includes('OPENAI_API_KEY')) {
      errorMessage = 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.'
      statusCode = 500
    } else if (errorMessage.includes('LLM Core Services URL not configured') || errorMessage.includes('LLM_CORE_URL')) {
      errorMessage = 'LLM Core Services URL not configured. Please add LLM_CORE_URL to your .env file, or set AI_PROVIDER=openai to use OpenAI.'
      statusCode = 500
    } else if (errorMessage.includes('401') || errorMessage.includes('Incorrect API key')) {
      errorMessage = 'Invalid API key. Please check your API key in .env file.'
      statusCode = 401
    } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      errorMessage = 'API rate limit exceeded. Please try again later.'
      statusCode = 429
    }
    
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        errorMessage
      ),
      { status: statusCode }
    )
  }
}

/**
 * GET /api/ai/chat
 * Get chat history
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
    const limit = parseInt(searchParams.get('limit') || '50')

    const history = await getChatHistoryForUser(session.user.id, limit)

    return NextResponse.json({
      messages: history,
      total: history.length
    })
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch chat history'
      ),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ai/chat
 * Clear chat history
 */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    await clearChatHistory(session.user.id)

    return NextResponse.json({
      message: 'Chat history cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing chat history:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to clear chat history'
      ),
      { status: 500 }
    )
  }
}

