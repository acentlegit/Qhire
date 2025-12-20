import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'
import OpenAI from 'openai'
import { prisma } from '../../../../../lib/db.js'

export const dynamic = 'force-dynamic'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const MAX_CONTEXT_MESSAGES = 20

/**
 * GET /api/ai/chat/stream
 * Stream chat response for real-time AI replies
 * 
 * Query params:
 * - message: string (required)
 * - entityType?: string (optional)
 * - entityId?: string (optional)
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

    // Check if provider is configured
    const provider = process.env.AI_PROVIDER || 'openai'
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'OpenAI API key not configured'),
        { status: 500 }
      )
    }
    if (provider === 'llm-core' && !process.env.LLM_CORE_URL) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.SERVER_ERROR, 'LLM Core Services URL not configured'),
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const message = searchParams.get('message')
    const entityType = searchParams.get('entityType') || null
    const entityId = searchParams.get('entityId') || null

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Message is required'),
        { status: 400 }
      )
    }

    // Get chat history
    const historyMessages = await prisma.chatMessage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTEXT_MESSAGES
    })

    // Map database role values to OpenAI format (USER -> user, ASSISTANT -> assistant)
    const history = historyMessages.reverse().map(msg => ({
      role: msg.role === 'USER' ? 'user' : msg.role === 'ASSISTANT' ? 'assistant' : msg.role.toLowerCase(),
      content: msg.content
    }))

    // Get entity context if provided
    let entityContext = ''
    if (entityType && entityId) {
      try {
        if (entityType === 'JOB' && entityId) {
          const job = await prisma.job.findUnique({
            where: { id: entityId },
            include: {
              createdBy: { select: { name: true, email: true } },
              Applications: {
                take: 5,
                include: {
                  candidate: { select: { name: true, email: true } }
                }
              }
            }
          })
          if (job) {
            entityContext = `Current Job: ${job.title}\nDescription: ${job.description.substring(0, 500)}\nStatus: ${job.status}\nApplications: ${job.Applications.length}`
          }
        } else if (entityType === 'CANDIDATE' && entityId) {
          const candidate = await prisma.candidate.findUnique({
            where: { id: entityId },
            include: {
              Applications: {
                take: 5,
                include: {
                  job: { select: { title: true, status: true } }
                }
              }
            }
          })
          if (candidate) {
            entityContext = `Current Candidate: ${candidate.name} (${candidate.email})\nSkills: ${candidate.skills || 'N/A'}\nCurrent Role: ${candidate.currentRole || 'N/A'}\nApplications: ${candidate.Applications.length}`
          }
        }
      } catch (error) {
        console.error('Error fetching entity context:', error)
      }
    }

    const systemPrompt = `You are an AI assistant for QHire, an AI-powered recruitment platform. Your role is to help recruiters and hiring managers with:

1. **Candidate Evaluation**: Analyze candidates, suggest interview questions, identify strengths/gaps
2. **Job Posting**: Help write job descriptions, suggest requirements, optimize postings
3. **Pipeline Management**: Provide insights on applications, suggest next steps
4. **Best Practices**: Share recruitment best practices and tips

${entityContext ? `\nCurrent Context:\n${entityContext}\n` : ''}

Guidelines:
- Be concise and actionable
- Focus on data-driven insights
- Suggest specific next steps
- Maintain professional tone
- If asked about data you don't have access to, say so clearly`

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Save user message first
          // Map entityType/entityId to contextType/contextId (schema uses contextType/contextId)
          await prisma.chatMessage.create({
            data: {
              userId: session.user.id,
              role: 'USER',
              content: message.trim(),
              contextType: entityType || null,
              contextId: entityId || null
            }
          })

          // Build messages array
          const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: message.trim() }
          ]

          // Call AI Provider with streaming
          let fullResponse = ''
          let usage = { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }

          // Stream the response
          for await (const chunk of aiProvider.chatCompletionStream({
            messages,
            model: CHAT_MODEL,
            temperature: 0.7,
            max_tokens: 1000
          })) {
            if (chunk.content) {
              fullResponse += chunk.content
              // Send chunk to client
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
            }
            if (chunk.usage) {
              usage = chunk.usage
            }
            if (chunk.done) {
              break
            }
          }

          // Save assistant message
          // Map entityType/entityId to contextType/contextId (schema uses contextType/contextId)
          await prisma.chatMessage.create({
            data: {
              userId: session.user.id,
              role: 'ASSISTANT',
              content: fullResponse,
              contextType: entityType || null,
              contextId: entityId || null
            }
          })

          // Track AI usage
          // If usage not provided, estimate tokens (~4 chars per token)
          const inputTokens = usage.prompt_tokens || Math.ceil(systemPrompt.length / 4) + Math.ceil(message.length / 4) + (history.length * 50)
          const outputTokens = usage.completion_tokens || Math.ceil(fullResponse.length / 4)
          const totalTokens = usage.total_tokens || (inputTokens + outputTokens)

          await trackAIUsage({
            userId: session.user.id,
            service: 'chat',
            tokens: totalTokens,
            inputTokens,
            outputTokens,
            model: CHAT_MODEL,
            metadata: { entityType, entityId, streamed: true, provider: aiProvider.getProviderName() }
          })

          // Send completion signal
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          const errorMessage = error.message || 'Failed to process chat message'
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`
              )
            )
          } catch (e) {
            console.error('Failed to send error in stream:', e)
          }
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Chat stream error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to stream chat response'
      ),
      { status: 500 }
    )
  }
}

