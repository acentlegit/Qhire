import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { parseResume, parseResumeFromUrl } from '../../../../lib/ai/resume-parser.js'
import { prisma } from '../../../../lib/db.js'
import { logActivity } from '../../../../lib/activity.js'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/parse-resume
 * Parse a resume file or URL
 * 
 * Request body:
 * {
 *   candidateId: string (optional, if updating existing candidate)
 *   fileUrl: string (optional, if parsing from URL)
 *   fileBuffer: Buffer (optional, if parsing from file)
 *   mimeType: string (required)
 * }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    let data
    try {
      data = await req.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body'),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    const { candidateId, fileUrl, mimeType } = data

    if (!fileUrl && !data.fileBuffer) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Either fileUrl or fileBuffer is required'),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!mimeType) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'mimeType is required'),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse resume
    let parsedData
    if (fileUrl) {
      // Check if this is a local file URL (development mode)
      if (fileUrl.includes('/api/upload/local')) {
        try {
          // Extract key from URL - handle both absolute and relative URLs
          let key
          if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            const urlObj = new URL(fileUrl)
            key = urlObj.searchParams.get('key')
          } else {
            // Relative URL - parse manually
            const match = fileUrl.match(/[?&]key=([^&]+)/)
            key = match ? decodeURIComponent(match[1]) : null
          }
          
          console.log('Local file URL detected, key:', key)
          
          if (key) {
            // Read file from local storage
            const UPLOAD_DIR = join(process.cwd(), 'uploads')
            const keyParts = key.split('/')
            const fileName = keyParts.pop() || 'file'
            const dirPath = keyParts.length > 0 ? join(UPLOAD_DIR, ...keyParts) : UPLOAD_DIR
            const filePath = join(dirPath, fileName)
            
            console.log('Looking for file at:', filePath)
            
            if (existsSync(filePath)) {
              console.log('File found, reading from:', filePath)
              const buffer = await readFile(filePath)
              console.log('File read successfully, size:', buffer.length, 'bytes, mimeType:', mimeType)
              
              if (buffer.length === 0) {
                throw new Error('Uploaded file is empty (0 bytes)')
              }
              
              // Verify it's a valid file by checking magic bytes
              const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 // %PDF
              const isDOCX = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04 // PK (ZIP header for DOCX)
              const isDOC = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 // MS Office old format
              
              console.log('File magic bytes check - isPDF:', isPDF, 'isDOCX:', isDOCX, 'isDOC:', isDOC)
              
              // Warn if MIME type doesn't match file content
              if (mimeType === 'application/pdf' && !isPDF) {
                console.warn('Warning: MIME type says PDF but file magic bytes suggest otherwise')
              } else if ((mimeType.includes('wordprocessingml') || mimeType.includes('msword')) && !isDOCX && !isDOC) {
                console.warn('Warning: MIME type says Word doc but file magic bytes suggest otherwise')
              }
              
              try {
                parsedData = await parseResume(buffer, mimeType, session.user.id)
                console.log('Resume parsed successfully')
              } catch (parseError) {
                console.error('Error in parseResume:', parseError)
                console.error('Parse error stack:', parseError.stack)
                throw parseError // Re-throw with original error message
              }
            } else {
              // Try alternative path format (without directory structure)
              const altPath = join(UPLOAD_DIR, key.replace(/\//g, '_'))
              console.log('Trying alternative path:', altPath)
              if (existsSync(altPath)) {
                const buffer = await readFile(altPath)
                console.log('File read from alt path, size:', buffer.length, 'bytes')
                parsedData = await parseResume(buffer, mimeType, session.user.id)
              } else {
                throw new Error(`Local file not found at ${filePath} or ${altPath}`)
              }
            }
          } else {
            throw new Error('Invalid local file URL: missing key parameter. URL: ' + fileUrl)
          }
        } catch (localError) {
          console.error('Error reading local file:', localError)
          throw new Error(`Failed to read local file: ${localError.message}`)
        }
      } else {
        // For S3 or external URLs, use fetch
        parsedData = await parseResumeFromUrl(fileUrl, mimeType, session.user.id)
      }
    } else {
      // If fileBuffer is provided as base64, decode it
      const buffer = Buffer.from(data.fileBuffer, 'base64')
      parsedData = await parseResume(buffer, mimeType, session.user.id)
    }

    // Update candidate if candidateId is provided
    if (candidateId) {
      // Get current candidate to check existing email
      const currentCandidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { email: true }
      })
      
      if (!currentCandidate) {
        return NextResponse.json(
          createErrorResponse(ERROR_CODES.NOT_FOUND, 'Candidate not found'),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
      
      // Prepare update data
      const updateData = {
        name: parsedData.name || undefined,
        phone: parsedData.phone || undefined,
        skills: parsedData.skills ? parsedData.skills.join(', ') : undefined,
        skillsParsed: parsedData.skills || undefined,
        experience: parsedData.experience || undefined,
        education: parsedData.education || undefined,
        currentCompany: parsedData.currentCompany || undefined,
        currentRole: parsedData.currentRole || undefined,
        yearsExperience: parsedData.yearsExperience ? parseInt(parsedData.yearsExperience) : undefined,
        resumeText: parsedData.resumeText || undefined,
        resumeParsedAt: parsedData.parsedAt || new Date(),
        resumeParseConfidence: parsedData.confidence || undefined
      }
      
      // Only update email if:
      // 1. Parsed email exists
      // 2. It's different from current email
      // 3. It doesn't conflict with another candidate
      if (parsedData.email && parsedData.email !== currentCandidate.email) {
        // Check if email is already used by another candidate
        const existingCandidate = await prisma.candidate.findUnique({
          where: { email: parsedData.email },
          select: { id: true }
        })
        
        if (existingCandidate && existingCandidate.id !== candidateId) {
          console.warn(`Email ${parsedData.email} already exists for another candidate. Skipping email update.`)
          // Don't update email, but continue with other fields
        } else {
          // Safe to update email
          updateData.email = parsedData.email
        }
      }
      
      const candidate = await prisma.candidate.update({
        where: { id: candidateId },
        data: updateData
      })

      await logActivity({
        userId: session.user.id,
        action: 'UPDATED',
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        metadata: { 
          action: 'resume_parsed',
          confidence: parsedData.confidence 
        }
      })

      return NextResponse.json({
        candidate,
        parsed: parsedData,
        message: 'Resume parsed and candidate updated successfully'
      }, {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return parsed data without updating candidate
    return NextResponse.json({
      parsed: parsedData,
      message: 'Resume parsed successfully'
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Resume parsing error:', error)
    console.error('Error stack:', error.stack)
    
    // Safely log request data (data might be undefined if error occurred before parsing)
    try {
      console.error('Request data:', { 
        candidateId: data?.candidateId, 
        fileUrl: data?.fileUrl, 
        mimeType: data?.mimeType,
        hasFileBuffer: !!data?.fileBuffer 
      })
    } catch (logError) {
      console.error('Could not log request data:', logError)
    }
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to parse resume'
    
    if (errorMessage.includes('OpenAI API key not configured') || errorMessage.includes('OPENAI_API_KEY')) {
      errorMessage = 'OpenAI API key not configured. Please add OPENAI_API_KEY=sk-your-key to your .env file and restart the server.'
    } else if (errorMessage.includes('Failed to parse PDF') || errorMessage.includes('Failed to parse DOCX')) {
      errorMessage = 'Failed to extract text from resume. Please ensure the file is a valid PDF or Word document.'
    } else if (errorMessage.includes('Local file not found')) {
      errorMessage = 'Uploaded file not found. Please try uploading again.'
    } else if (errorMessage.includes('Resume text is too short')) {
      errorMessage = 'Could not extract enough text from resume. Please ensure the file contains readable text.'
    }
    
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        errorMessage
      ),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

