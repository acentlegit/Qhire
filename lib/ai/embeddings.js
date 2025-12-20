/**
 * Embeddings Service
 * Generates embeddings for jobs and candidates using AI Provider (OpenAI or LLM Core Services)
 */

import aiProvider from './provider.js'
import { trackAIUsage } from './usage-tracker.js'

// Get embedding model based on provider
const EMBEDDING_MODEL = process.env.AI_PROVIDER === 'llm-core'
  ? (process.env.LLM_CORE_EMBEDDING_MODEL || process.env.LLM_CORE_MODEL || 'llama-3-8b')
  : (process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small')

const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS 
  ? parseInt(process.env.EMBEDDING_DIMENSIONS) 
  : 1536 // Default for text-embedding-3-small

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, userId = 'system') {
  // Check if provider is configured
  const provider = process.env.AI_PROVIDER || 'openai'
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
  }
  if (provider === 'llm-core' && !process.env.LLM_CORE_URL) {
    throw new Error('LLM Core Services URL not configured. Set LLM_CORE_URL in .env')
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty')
  }

  try {
    const response = await aiProvider.generateEmbedding({
      input: text.substring(0, 8000), // Limit to avoid token limits
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS
    })

    const embedding = response.data[0]?.embedding
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response')
    }

    // Track AI usage
    if (response.usage && userId !== 'system') {
      await trackAIUsage({
        userId,
        service: 'embeddings',
        tokens: response.usage.total_tokens || 0,
        inputTokens: response.usage.total_tokens || 0,
        outputTokens: 0, // Embeddings don't have output tokens
        model: EMBEDDING_MODEL,
        metadata: { 
          textLength: text.length,
          dimensions: EMBEDDING_DIMENSIONS,
          provider: aiProvider.getProviderName()
        }
      })
    }

    return embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error(`Failed to generate embedding: ${error.message}`)
  }
}

/**
 * Generate embedding for job description
 * @param {Object} job - Job object
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateJobEmbedding(job) {
  const text = [
    job.title || '',
    job.description || '',
    job.requirements ? (Array.isArray(job.requirements) ? job.requirements.join(' ') : job.requirements) : '',
    job.department || '',
    job.location || '',
    job.experienceLevel || ''
  ].filter(Boolean).join('\n')

  return await generateEmbedding(text)
}

/**
 * Generate embedding for candidate
 * @param {Object} candidate - Candidate object
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateCandidateEmbedding(candidate) {
  // Build text from candidate data
  const parts = []

  // Skills
  if (candidate.skills) {
    parts.push(`Skills: ${candidate.skills}`)
  }
  if (candidate.skillsParsed && Array.isArray(candidate.skillsParsed)) {
    parts.push(`Skills: ${candidate.skillsParsed.join(', ')}`)
  }

  // Experience
  if (candidate.experience && Array.isArray(candidate.experience)) {
    const expText = candidate.experience.map(exp => 
      `${exp.role || ''} at ${exp.company || ''} - ${exp.description || ''}`
    ).join('\n')
    parts.push(`Experience:\n${expText}`)
  }

  // Education
  if (candidate.education && Array.isArray(candidate.education)) {
    const eduText = candidate.education.map(edu => 
      `${edu.degree || ''} from ${edu.institution || ''}`
    ).join('\n')
    parts.push(`Education:\n${eduText}`)
  }

  // Resume text (if available)
  if (candidate.resumeText) {
    parts.push(candidate.resumeText.substring(0, 3000)) // First 3000 chars
  }

  // Current role
  if (candidate.currentRole) {
    parts.push(`Current role: ${candidate.currentRole}`)
  }
  if (candidate.currentCompany) {
    parts.push(`Current company: ${candidate.currentCompany}`)
  }

  const text = parts.join('\n\n')
  if (!text || text.trim().length < 10) {
    throw new Error('Candidate data is too sparse to generate embedding')
  }

  return await generateEmbedding(text)
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2) {
    return 0
  }

  if (embedding1.length !== embedding2.length) {
    console.warn('Embedding dimensions mismatch')
    return 0
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i]
    norm1 += embedding1[i] * embedding1[i]
    norm2 += embedding2[i] * embedding2[i]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (norm1 === 0 || norm2 === 0) {
    return 0
  }

  return dotProduct / (norm1 * norm2)
}

/**
 * Calculate match score between job and candidate
 * Multi-factor scoring: embeddings (50%) + keyword matching (50%)
 * @param {Object} job - Job object
 * @param {Object} candidate - Candidate object
 * @param {number[]} jobEmbedding - Job embedding vector
 * @param {number[]} candidateEmbedding - Candidate embedding vector
 * @returns {Object} Match score and reasons
 */
export function calculateMatchScore(job, candidate, jobEmbedding, candidateEmbedding) {
  // 1. Embedding similarity (50%)
  const embeddingScore = cosineSimilarity(jobEmbedding, candidateEmbedding)

  // 2. Keyword matching (50%)
  const keywordScore = calculateKeywordMatch(job, candidate)

  // Overall score (weighted average)
  const overallScore = (embeddingScore * 0.5) + (keywordScore * 0.5)

  // Generate match reasons
  const reasons = generateMatchReasons(job, candidate, embeddingScore, keywordScore)

  return {
    score: Math.round(overallScore * 100) / 100, // Round to 2 decimals
    embeddingScore: Math.round(embeddingScore * 100) / 100,
    keywordScore: Math.round(keywordScore * 100) / 100,
    reasons,
    strengths: reasons.filter(r => r.type === 'strength'),
    gaps: reasons.filter(r => r.type === 'gap')
  }
}

/**
 * Calculate keyword-based match score
 */
function calculateKeywordMatch(job, candidate) {
  let matches = 0
  let total = 0

  // Extract keywords from job
  const jobKeywords = extractKeywords(job.requirements || job.description || '')
  const jobSkills = extractKeywords(job.requirements || '')

  // Extract keywords from candidate
  const candidateSkills = []
  if (candidate.skills) {
    candidateSkills.push(...candidate.skills.split(',').map(s => s.trim().toLowerCase()))
  }
  if (candidate.skillsParsed && Array.isArray(candidate.skillsParsed)) {
    candidateSkills.push(...candidate.skillsParsed.map(s => s.toLowerCase()))
  }

  // Match skills
  for (const skill of jobSkills) {
    total++
    if (candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))) {
      matches++
    }
  }

  // Experience level match
  if (job.experienceLevel) {
    total++
    const candidateExp = candidate.yearsExperience || 0
    const requiredExp = parseExperienceLevel(job.experienceLevel)
    if (candidateExp >= requiredExp) {
      matches++
    }
  }

  return total > 0 ? matches / total : 0
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  if (!text) return []
  
  // Simple keyword extraction (can be enhanced)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3) // Filter short words
  
  // Common tech keywords
  const techKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'node', 'angular', 'vue',
    'aws', 'azure', 'docker', 'kubernetes', 'sql', 'mongodb', 'postgresql',
    'agile', 'scrum', 'ci/cd', 'devops', 'api', 'rest', 'graphql'
  ]
  
  return [...new Set([...words, ...techKeywords.filter(kw => text.toLowerCase().includes(kw))])]
}

/**
 * Parse experience level to years
 */
function parseExperienceLevel(level) {
  const mapping = {
    'entry': 0,
    'junior': 1,
    'mid': 3,
    'senior': 5,
    'lead': 7,
    'principal': 10
  }
  return mapping[level?.toLowerCase()] || 0
}

/**
 * Generate match reasons
 */
function generateMatchReasons(job, candidate, embeddingScore, keywordScore) {
  const reasons = []

  // Strengths
  if (embeddingScore > 0.7) {
    reasons.push({
      type: 'strength',
      text: 'Strong semantic match with job requirements',
      score: embeddingScore
    })
  }

  if (keywordScore > 0.6) {
    reasons.push({
      type: 'strength',
      text: 'Good keyword/skill alignment',
      score: keywordScore
    })
  }

  // Check specific skills match
  const candidateSkills = []
  if (candidate.skills) candidateSkills.push(...candidate.skills.split(',').map(s => s.trim()))
  if (candidate.skillsParsed) candidateSkills.push(...candidate.skillsParsed)

  const jobReq = (job.requirements || '').toLowerCase()
  const matchedSkills = candidateSkills.filter(skill => jobReq.includes(skill.toLowerCase()))
  if (matchedSkills.length > 0) {
    reasons.push({
      type: 'strength',
      text: `Matched skills: ${matchedSkills.slice(0, 5).join(', ')}`,
      score: matchedSkills.length / Math.max(candidateSkills.length, 1)
    })
  }

  // Gaps
  if (embeddingScore < 0.5) {
    reasons.push({
      type: 'gap',
      text: 'Low semantic similarity with job description',
      score: 1 - embeddingScore
    })
  }

  if (keywordScore < 0.4) {
    reasons.push({
      type: 'gap',
      text: 'Limited keyword/skill overlap',
      score: 1 - keywordScore
    })
  }

  return reasons
}

