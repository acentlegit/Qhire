/**
 * AI Usage Tracking Service
 * Tracks OpenAI API usage and calculates costs
 */

import { prisma } from '../db.js'

// Pricing per 1M tokens
// OpenAI pricing (as of 2024)
const OPENAI_PRICING = {
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4': { input: 30.00 / 1_000_000, output: 60.00 / 1_000_000 },
  'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
  'text-embedding-3-small': { input: 0.02 / 1_000_000, output: 0 },
  'text-embedding-3-large': { input: 0.13 / 1_000_000, output: 0 },
}

// LLM Core Services pricing (self-hosted, typically lower cost)
// Configure via LLM_CORE_COST_PER_1M_TOKENS env var, or use defaults
const LLM_CORE_PRICING = {
  'llama-3-8b': { input: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.01') / 1_000_000, output: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.01') / 1_000_000 },
  'llama-3-70b': { input: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.05') / 1_000_000, output: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.05') / 1_000_000 },
  'default': { input: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.01') / 1_000_000, output: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.01') / 1_000_000 },
}

// Embedding models pricing
const EMBEDDING_PRICING = {
  'text-embedding-3-small': { input: 0.02 / 1_000_000, output: 0 },
  'text-embedding-3-large': { input: 0.13 / 1_000_000, output: 0 },
  // LLM Core Services embeddings (typically same as chat cost)
  'llama-3-8b': { input: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.01') / 1_000_000, output: 0 },
  'llama-3-70b': { input: parseFloat(process.env.LLM_CORE_COST_PER_1M_TOKENS || '0.05') / 1_000_000, output: 0 },
}

// Get pricing based on provider
function getPricing(model, service = 'chat') {
  const provider = process.env.AI_PROVIDER || 'openai'
  
  // Check if it's an embedding model
  if (service === 'embeddings' || model.includes('embedding')) {
    return EMBEDDING_PRICING[model] || (provider === 'llm-core' 
      ? LLM_CORE_PRICING[model] || LLM_CORE_PRICING['default']
      : EMBEDDING_PRICING['text-embedding-3-small'])
  }
  
  // Chat/completion models
  if (provider === 'llm-core') {
    return LLM_CORE_PRICING[model] || LLM_CORE_PRICING['default']
  }
  return OPENAI_PRICING[model] || OPENAI_PRICING['gpt-4o-mini']
}

/**
 * Track AI usage and calculate cost
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.service - Service name ('chat', 'resume_parse', 'interview', 'matching')
 * @param {number} params.tokens - Total tokens used
 * @param {number} [params.inputTokens] - Input tokens (optional)
 * @param {number} [params.outputTokens] - Output tokens (optional)
 * @param {string} [params.model='gpt-4o-mini'] - Model used
 * @param {Object} [params.metadata] - Additional context (jobId, candidateId, etc.)
 * @returns {Promise<{cost: number, tokens: number}>}
 */
export async function trackAIUsage({
  userId,
  service,
  tokens,
  inputTokens = null,
  outputTokens = null,
  model = 'gpt-4o-mini',
  metadata = null
}) {
  try {
    // Get pricing for model based on provider and service type
    const pricing = getPricing(model, service)
    
    // Calculate costs
    const actualInputTokens = inputTokens !== null ? inputTokens : tokens
    const actualOutputTokens = outputTokens !== null ? outputTokens : 0
    
    const inputCost = actualInputTokens * pricing.input
    const outputCost = actualOutputTokens * pricing.output
    const totalCost = inputCost + outputCost

    // Save usage record
    await prisma.aIUsage.create({
      data: {
        userId,
        service,
        tokens,
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        cost: totalCost,
        model,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null
      }
    })

    // Update user's total cost (increment both total and monthly)
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalAICost: { increment: totalCost },
        monthlyAICost: { increment: totalCost }
      }
    })

    return { cost: totalCost, tokens }
  } catch (error) {
    console.error('Failed to track AI usage:', error)
    // Don't throw - usage tracking failure shouldn't break the main flow
    return { cost: 0, tokens: 0 }
  }
}

/**
 * Get usage statistics for a user
 * @param {string} userId - User ID
 * @param {Object} [options] - Options
 * @param {Date} [options.startDate] - Start date for filtering
 * @param {Date} [options.endDate] - End date for filtering
 * @param {string} [options.service] - Filter by service
 * @returns {Promise<Object>}
 */
export async function getUserUsageStats(userId, options = {}) {
  const { startDate, endDate, service } = options

  const where = { userId }
  if (startDate) {
    where.createdAt = { gte: startDate }
  }
  if (endDate) {
    where.createdAt = { ...where.createdAt, lte: endDate }
  }
  if (service) {
    where.service = service
  }

  const usage = await prisma.aIUsage.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })

  const totalCost = usage.reduce((sum, u) => sum + u.cost, 0)
  const totalTokens = usage.reduce((sum, u) => sum + u.tokens, 0)
  const totalInputTokens = usage.reduce((sum, u) => sum + (u.inputTokens || 0), 0)
  const totalOutputTokens = usage.reduce((sum, u) => sum + (u.outputTokens || 0), 0)

  // Group by service
  const byService = usage.reduce((acc, u) => {
    if (!acc[u.service]) {
      acc[u.service] = { count: 0, cost: 0, tokens: 0 }
    }
    acc[u.service].count++
    acc[u.service].cost += u.cost
    acc[u.service].tokens += u.tokens
    return acc
  }, {})

  return {
    totalCost,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    count: usage.length,
    byService,
    usage: usage.slice(0, 100) // Return last 100 records
  }
}

/**
 * Get monthly cost forecast
 * @param {string} userId - User ID
 * @returns {Promise<number>} Projected monthly cost
 */
export async function getMonthlyForecast(userId) {
  // Get last 30 days of usage
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const usage = await prisma.aIUsage.findMany({
    where: {
      userId,
      createdAt: { gte: thirtyDaysAgo }
    }
  })

  const totalCost = usage.reduce((sum, u) => sum + u.cost, 0)
  const avgDailyCost = totalCost / 30
  const projectedMonthly = avgDailyCost * 30

  return projectedMonthly
}

/**
 * Reset monthly cost (should be called at start of each month)
 * @param {string} userId - User ID
 */
export async function resetMonthlyCost(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { monthlyAICost: 0 }
  })
}

