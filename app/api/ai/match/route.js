import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { 
  generateJobEmbedding, 
  generateCandidateEmbedding,
  calculateMatchScore 
} from '../../../../lib/ai/embeddings.js'
import { prisma } from '../../../../lib/db.js'
import { withRetry } from '../../../../lib/db-retry.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/match
 * Calculate match score between a job and candidate
 * 
 * Request body:
 * {
 *   jobId: string (required)
 *   candidateId: string (required)
 *   updateApplication?: boolean (optional, if true, updates application match score)
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
    const { jobId, candidateId, updateApplication = false } = data

    if (!jobId || !candidateId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'jobId and candidateId are required'),
        { status: 400 }
      )
    }

    // Fetch job and candidate
    const [job, candidate] = await withRetry(async () => Promise.all([
      prisma.job.findUnique({ where: { id: jobId } }),
      prisma.candidate.findUnique({ where: { id: candidateId } })
    ]))

    if (!job) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      )
    }

    if (!candidate) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
        { status: 404 }
      )
    }

    // Get or generate job embedding
    let jobEmbedding = job.embeddingJson
    if (!jobEmbedding || !Array.isArray(jobEmbedding)) {
      jobEmbedding = await generateJobEmbedding(job)
      // Save embedding to job
      await prisma.job.update({
        where: { id: jobId },
        data: { embeddingJson: jobEmbedding }
      })
    }

    // Get or generate candidate embedding
    let candidateEmbedding = candidate.embeddingJson
    if (!candidateEmbedding || !Array.isArray(candidateEmbedding)) {
      candidateEmbedding = await generateCandidateEmbedding(candidate)
      // Save embedding to candidate
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { embeddingJson: candidateEmbedding }
      })
    }

    // Calculate match score
    const matchResult = calculateMatchScore(job, candidate, jobEmbedding, candidateEmbedding)

    // Update application if requested
    if (updateApplication) {
      const application = await prisma.application.findFirst({
        where: {
          jobId,
          candidateId
        }
      })

      if (application) {
        await prisma.application.update({
          where: { id: application.id },
          data: {
            matchScore: matchResult.score
          }
        })
      }
    }

    return NextResponse.json({
      matchScore: matchResult.score,
      embeddingScore: matchResult.embeddingScore,
      keywordScore: matchResult.keywordScore,
      reasons: matchResult.reasons,
      strengths: matchResult.strengths,
      gaps: matchResult.gaps,
      job: {
        id: job.id,
        title: job.title
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email
      }
    })
  } catch (error) {
    console.error('Match calculation error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to calculate match score'
      ),
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/match?jobId=xxx
 * Get top matching candidates for a job
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
    const jobId = searchParams.get('jobId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!jobId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'jobId is required'),
        { status: 400 }
      )
    }

    // Fetch job
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Job not found'),
        { status: 404 }
      )
    }

    // Get or generate job embedding
    let jobEmbedding = job.embeddingJson
    if (!jobEmbedding || !Array.isArray(jobEmbedding)) {
      jobEmbedding = await generateJobEmbedding(job)
      await prisma.job.update({
        where: { id: jobId },
        data: { embeddingJson: jobEmbedding }
      })
    }

    // Fetch candidates with embeddings
    const candidates = await prisma.candidate.findMany({
      where: {
        embeddingJson: { not: null }
      },
      take: limit * 2 // Get more to filter
    })

    // Calculate match scores
    const matches = []
    for (const candidate of candidates) {
      if (!candidate.embeddingJson || !Array.isArray(candidate.embeddingJson)) {
        continue
      }

      const matchResult = calculateMatchScore(
        job,
        candidate,
        jobEmbedding,
        candidate.embeddingJson
      )

      matches.push({
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          skills: candidate.skills
        },
        matchScore: matchResult.score,
        embeddingScore: matchResult.embeddingScore,
        keywordScore: matchResult.keywordScore,
        strengths: matchResult.strengths.slice(0, 3), // Top 3 strengths
        gaps: matchResult.gaps.slice(0, 2) // Top 2 gaps
      })
    }

    // Sort by match score and return top N
    matches.sort((a, b) => b.matchScore - a.matchScore)

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title
      },
      matches: matches.slice(0, limit),
      total: matches.length
    })
  } catch (error) {
    console.error('Match search error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to find matches'
      ),
      { status: 500 }
    )
  }
}

