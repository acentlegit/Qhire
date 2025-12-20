/**
 * AI Assistant Chat Service
 * Provides context-aware chat assistance for recruiters
 */

import aiProvider from './provider.js'
import { prisma } from '../db.js'
import { trackAIUsage } from './usage-tracker.js'

// Get model based on provider
const CHAT_MODEL = process.env.AI_PROVIDER === 'llm-core'
  ? (process.env.LLM_CORE_MODEL || 'llama-3-8b')
  : (process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini')
const MAX_CONTEXT_MESSAGES = 20 // Keep last 20 messages for context

/**
 * Get chat history for a user
 */
async function getChatHistory(userId, limit = MAX_CONTEXT_MESSAGES) {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  })

  // Reverse to get chronological order
  // Map database role values to OpenAI format (USER -> user, ASSISTANT -> assistant)
  return messages.reverse().map(msg => ({
    role: msg.role === 'USER' ? 'user' : msg.role === 'ASSISTANT' ? 'assistant' : msg.role.toLowerCase(),
    content: msg.content
  }))
}

/**
 * Get context about current entities (jobs, candidates, applications)
 */
async function getEntityContext(userId, entityType, entityId) {
  const context = []

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
        context.push(`Current Job: ${job.title}`)
        context.push(`Description: ${job.description.substring(0, 500)}`)
        context.push(`Status: ${job.status}`)
        context.push(`Applications: ${job.Applications.length}`)
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
        context.push(`Current Candidate: ${candidate.name} (${candidate.email})`)
        if (candidate.skills) context.push(`Skills: ${candidate.skills}`)
        if (candidate.currentRole) context.push(`Current Role: ${candidate.currentRole}`)
        context.push(`Applications: ${candidate.Applications.length}`)
      }
    } else if (entityType === 'APPLICATION' && entityId) {
      const application = await prisma.application.findUnique({
        where: { id: entityId },
        include: {
          job: { select: { title: true, description: true } },
          candidate: { select: { name: true, email: true, skills: true } }
        }
      })

      if (application) {
        context.push(`Application for: ${application.job.title}`)
        context.push(`Candidate: ${application.candidate.name}`)
        context.push(`Stage: ${application.stage}`)
        if (application.matchScore) {
          context.push(`Match Score: ${application.matchScore}`)
        }
      }
    }
  } catch (error) {
    console.error('Error fetching entity context:', error)
  }

  return context.join('\n')
}

/**
 * Generate system prompt with context
 */
function generateSystemPrompt(entityContext) {
  return `You are an AI assistant for QHire, an AI-powered recruitment platform. Your role is to help recruiters and hiring managers with:

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
}

/**
 * Process chat message and generate response
 */
export async function processChatMessage(userId, message, entityType = null, entityId = null) {
  // Check if provider is configured
  const provider = process.env.AI_PROVIDER || 'openai'
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
  }
  if (provider === 'llm-core' && !process.env.LLM_CORE_URL) {
    throw new Error('LLM Core Services URL not configured. Set LLM_CORE_URL in .env')
  }

  try {
    // Get chat history
    const history = await getChatHistory(userId)

    // Get entity context if provided
    const entityContext = entityType && entityId
      ? await getEntityContext(userId, entityType, entityId)
      : ''

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: generateSystemPrompt(entityContext)
      },
      ...history,
      {
        role: 'user',
        content: message
      }
    ]

    // Call AI Provider (OpenAI or LLM Core Services)
    const response = await aiProvider.chatCompletion({
      messages,
      model: CHAT_MODEL,
      temperature: 0.7,
      max_tokens: 1000
    })

    const assistantMessage = response.content
    if (!assistantMessage) {
      throw new Error('No response from AI')
    }

    // Track AI usage
    if (response.usage) {
      await trackAIUsage({
        userId,
        service: 'chat',
        tokens: response.usage.total_tokens || 0,
        inputTokens: response.usage.prompt_tokens || 0,
        outputTokens: response.usage.completion_tokens || 0,
        model: CHAT_MODEL,
        metadata: { entityType, entityId, provider: aiProvider.getProviderName() }
      })
    }

    // Save messages to database
    // Map entityType/entityId to contextType/contextId (schema uses contextType/contextId)
    const contextType = entityType || null
    const contextId = entityId || null
    
    await Promise.all([
      prisma.chatMessage.create({
        data: {
          userId,
          role: 'USER',
          content: message,
          contextType,
          contextId
        }
      }),
      prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: assistantMessage,
          contextType,
          contextId
        }
      })
    ])

    return {
      message: assistantMessage,
      entityType: contextType, // Return as entityType for API compatibility
      entityId: contextId // Return as entityId for API compatibility
    }
  } catch (error) {
    console.error('Chat processing error:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status
    })
    
    // Preserve original error message if it's informative
    if (error.message && (
      error.message.includes('OpenAI API key') ||
      error.message.includes('API key') ||
      error.message.includes('401') ||
      error.message.includes('429')
    )) {
      throw error
    }
    
    throw new Error(`Failed to process chat message: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userId) {
  await prisma.chatMessage.deleteMany({
    where: { userId }
  })
}

/**
 * Get chat history for display
 */
export async function getChatHistoryForUser(userId, limit = 50) {
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit
  })

  return messages.map(msg => ({
    id: msg.id,
    role: msg.role.toLowerCase(),
    content: msg.content,
    entityType: msg.contextType, // Map contextType to entityType for API compatibility
    entityId: msg.contextId, // Map contextId to entityId for API compatibility
    createdAt: msg.createdAt
  }))
}

