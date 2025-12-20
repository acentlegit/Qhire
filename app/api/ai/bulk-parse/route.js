import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { parseResume } from '../../../../lib/ai/resume-parser.js'
import { prisma } from '../../../../lib/db.js'
import { logActivity } from '../../../../lib/activity.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/bulk-parse
 * Parse multiple resumes in batch
 * 
 * Request body:
 * {
 *   jobId: string (optional, for matching)
 *   files: [
 *     {
 *       fileUrl: string,
 *       filename: string,
 *       mimeType: string,
 *       size: number
 *     }
 *   ],
 *   options: {
 *     autoCreateCandidates: boolean,
 *     autoMatch: boolean,
 *     topMatches: number (default: 10)
 *   }
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
    const { jobId, files, options = {} } = data

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'files array is required'),
        { status: 400 }
      )
    }

    // Create a batch job record
    const batchJob = await prisma.bulkParseJob.create({
      data: {
        jobId: jobId || null,
        createdBy: session.user.id,
        totalFiles: files.length,
        status: 'PROCESSING',
        options: options
      }
    })

    // Process files asynchronously (in production, use a queue like BullMQ)
    processBatchAsync(batchJob.id, files, jobId, session.user.id, options).catch(err => {
      console.error('Batch processing error:', err)
    })

    return NextResponse.json({
      batchJobId: batchJob.id,
      status: 'PROCESSING',
      total: files.length,
      message: 'Batch processing started'
    }, { status: 202 })
  } catch (error) {
    console.error('Bulk parse error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to start bulk parsing'
      ),
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/bulk-parse/[batchJobId]
 * Get batch processing status
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
    const batchJobId = searchParams.get('batchJobId')

    if (!batchJobId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'batchJobId is required'),
        { status: 400 }
      )
    }

    const batchJob = await prisma.bulkParseJob.findUnique({
      where: { id: batchJobId },
      include: {
        results: {
          include: {
            candidate: true
          }
        }
      }
    })

    if (!batchJob) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Batch job not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(batchJob)
  } catch (error) {
    console.error('Get batch status error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to get batch status'
      ),
      { status: 500 }
    )
  }
}

/**
 * Process batch asynchronously
 */
async function processBatchAsync(batchJobId, files, jobId, userId, options) {
  const results = []
  let processed = 0
  let errors = 0

  // Get job details if jobId provided (for matching)
  let job = null
  if (jobId) {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { pipelineStages: true }
    })
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    // Add delay between requests to avoid rate limiting (Groq free tier: 6000 TPM)
    // Wait 20 seconds between each resume to stay under rate limit
    if (i > 0) {
      console.log(`⏳ Waiting 20s before processing file ${i + 1}/${files.length} to avoid rate limits...`)
      await new Promise(resolve => setTimeout(resolve, 20000))
    }
    
    try {
      // Download file if URL provided
      let fileBuffer
      if (file.fileUrl) {
        // Check if it's a local file URL
        if (file.fileUrl.includes('/api/upload/local')) {
          // Extract the key from the URL
          let fileKey
          try {
            // Try to parse as URL (works if it has a base)
            if (file.fileUrl.startsWith('http')) {
              const urlObj = new URL(file.fileUrl)
              fileKey = urlObj.searchParams.get('key')
            } else {
              // Relative URL - extract key manually
              const match = file.fileUrl.match(/[?&]key=([^&]+)/)
              fileKey = match ? decodeURIComponent(match[1]) : null
            }
          } catch (urlError) {
            // Fallback: try to extract key manually
            const match = file.fileUrl.match(/[?&]key=([^&]+)/)
            fileKey = match ? decodeURIComponent(match[1]) : null
          }
          
          if (!fileKey) {
            console.error('Could not extract file key from URL:', file.fileUrl)
            throw new Error('File key not found in local URL')
          }
          
          // Read file directly from filesystem
          const fs = await import('fs/promises')
          const path = await import('path')
          const { existsSync } = await import('fs')
          const uploadsDir = path.join(process.cwd(), 'uploads')
          const filePath = path.join(uploadsDir, fileKey)
          
          // Check if file exists
          if (!existsSync(filePath)) {
            console.error(`File not found at path: ${filePath}`)
            console.error(`File key: ${fileKey}`)
            console.error(`Uploads directory: ${uploadsDir}`)
            throw new Error(`File not found: ${file.filename}. Please ensure the file was uploaded successfully.`)
          }
          
          try {
            fileBuffer = await fs.readFile(filePath)
            console.log(`✅ Successfully read local file: ${filePath} (${fileBuffer.length} bytes)`)
          } catch (readError) {
            console.error(`Error reading local file ${filePath}:`, readError)
            throw new Error(`Failed to read local file: ${readError.message}`)
          }
        } else {
          // It's an S3 URL or external URL - fetch it
          try {
            const response = await fetch(file.fileUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
            }
            fileBuffer = Buffer.from(await response.arrayBuffer())
          } catch (fetchError) {
            console.error(`Error fetching file from ${file.fileUrl}:`, fetchError)
            throw new Error(`Failed to fetch file: ${fetchError.message}`)
          }
        }
      } else if (file.fileBuffer) {
        fileBuffer = Buffer.from(file.fileBuffer, 'base64')
      } else {
        throw new Error('No file data provided')
      }

      // Parse resume
      const parsedData = await parseResume(fileBuffer, file.mimeType)

      // Extract email (critical requirement)
      const email = extractEmail(parsedData)

      // Create or update candidate if autoCreateCandidates is enabled
      let candidate = null
      if (options.autoCreateCandidates !== false) {
        // Check if candidate exists by email
        if (email) {
          candidate = await prisma.candidate.findUnique({
            where: { email }
          })
        }

        if (!candidate) {
          candidate = await prisma.candidate.create({
            data: {
              name: parsedData.name || 'Unknown',
              email: email || `candidate-${Date.now()}@temp.com`,
              phone: parsedData.phone || null,
              skills: parsedData.skills ? parsedData.skills.join(', ') : null,
              skillsParsed: parsedData.skills || [],
              experience: parsedData.experience || null,
              education: parsedData.education || null,
              currentCompany: parsedData.currentCompany || null,
              currentRole: parsedData.currentRole || null,
              yearsExperience: parsedData.yearsExperience ? parseInt(parsedData.yearsExperience) : null,
              resumeText: parsedData.resumeText || null,
              resumeParsedAt: new Date(),
              resumeParseConfidence: parsedData.confidence || null,
              resumeUrl: file.fileUrl || null
            }
          })
        } else {
          // Update existing candidate with parsed data
          candidate = await prisma.candidate.update({
            where: { id: candidate.id },
            data: {
              name: parsedData.name || candidate.name,
              phone: parsedData.phone || candidate.phone,
              skills: parsedData.skills ? parsedData.skills.join(', ') : candidate.skills,
              skillsParsed: parsedData.skills || candidate.skillsParsed,
              experience: parsedData.experience || candidate.experience,
              education: parsedData.education || candidate.education,
              currentCompany: parsedData.currentCompany || candidate.currentCompany,
              currentRole: parsedData.currentRole || candidate.currentRole,
              yearsExperience: parsedData.yearsExperience ? parseInt(parsedData.yearsExperience) : candidate.yearsExperience,
              resumeText: parsedData.resumeText || candidate.resumeText,
              resumeParsedAt: new Date(),
              resumeParseConfidence: parsedData.confidence || candidate.resumeParseConfidence,
              resumeUrl: file.fileUrl || candidate.resumeUrl
            }
          })
        }
      }

      // Calculate match score if job provided and autoMatch enabled
      let matchScore = null
      if (job && options.autoMatch !== false && candidate) {
        matchScore = await calculateMatchScore(candidate, job)
      }

      // Create parse result record
      const result = await prisma.bulkParseResult.create({
        data: {
          batchJobId,
          candidateId: candidate?.id || null,
          filename: file.filename,
          fileUrl: file.fileUrl,
          status: 'SUCCESS',
          parsedData: parsedData,
          email: email,
          matchScore: matchScore,
          error: null
        }
      })

      results.push({
        resultId: result.id,
        candidateId: candidate?.id,
        email: email,
        matchScore: matchScore,
        status: 'SUCCESS'
      })

      processed++

      // Update batch job progress
      await prisma.bulkParseJob.update({
        where: { id: batchJobId },
        data: {
          processedFiles: processed,
          errorFiles: errors,
          status: processed + errors >= files.length ? 'COMPLETED' : 'PROCESSING'
        }
      })

    } catch (error) {
      console.error(`Error processing file ${file.filename}:`, error)
      console.error(`Error stack:`, error.stack)
      console.error(`File details:`, {
        filename: file.filename,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        size: file.size
      })
      errors++

      // Create error result with detailed error message
      const errorMessage = error.message || 'Unknown error occurred'
      await prisma.bulkParseResult.create({
        data: {
          batchJobId,
          filename: file.filename,
          fileUrl: file.fileUrl,
          status: 'ERROR',
          error: errorMessage,
          parsedData: {
            error: errorMessage,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        }
      })

      // Update batch job
      await prisma.bulkParseJob.update({
        where: { id: batchJobId },
        data: {
          processedFiles: processed,
          errorFiles: errors,
          status: processed + errors >= files.length ? 'COMPLETED' : 'PROCESSING'
        }
      })
    }
  }

  // Log activity
  await logActivity({
    userId,
    action: 'CREATED',
    entityType: 'BULK_PARSE_JOB',
    entityId: batchJobId,
    metadata: {
      total: files.length,
      processed,
      errors,
      jobId
    }
  })

  return results
}

/**
 * Extract email from parsed resume data
 */
function extractEmail(parsedData) {
  // First try parsed email
  if (parsedData.email) {
    return parsedData.email
  }

  // Try to extract from resume text using regex
  if (parsedData.resumeText) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const matches = parsedData.resumeText.match(emailRegex)
    if (matches && matches.length > 0) {
      return matches[0]
    }
  }

  return null
}

/**
 * Calculate match score between candidate and job
 */
async function calculateMatchScore(candidate, job) {
  // Simple matching algorithm (can be enhanced with embeddings)
  let score = 0
  let factors = 0

  // Skills match (40%)
  if (candidate.skillsParsed && Array.isArray(candidate.skillsParsed) && job.requirements) {
    const jobRequirements = job.requirements.toLowerCase()
    const candidateSkills = candidate.skillsParsed.map(s => s.toLowerCase())
    const matchedSkills = candidateSkills.filter(skill => 
      jobRequirements.includes(skill)
    )
    const skillsScore = matchedSkills.length / Math.max(candidateSkills.length, 1)
    score += skillsScore * 0.4
    factors++
  }

  // Experience match (30%)
  if (candidate.yearsExperience && job.experienceLevel) {
    const expLevels = {
      'ENTRY': [0, 2],
      'MID': [2, 5],
      'SENIOR': [5, 10],
      'EXPERT': [10, 999]
    }
    const level = expLevels[job.experienceLevel.toUpperCase()]
    if (level && candidate.yearsExperience >= level[0] && candidate.yearsExperience <= level[1]) {
      score += 0.3
    }
    factors++
  }

  // Education match (20%)
  if (candidate.education && job.requirements) {
    const jobReq = job.requirements.toLowerCase()
    const hasEducation = candidate.education.some(edu => 
      jobReq.includes(edu.degree?.toLowerCase() || '') ||
      jobReq.includes(edu.institution?.toLowerCase() || '')
    )
    if (hasEducation) {
      score += 0.2
    }
    factors++
  }

  // Overall fit (10%)
  score += 0.1
  factors++

  return factors > 0 ? score / factors : 0
}

