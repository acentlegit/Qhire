import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * Gmail Profile Extraction API
 * POST /api/scraping/gmail
 * 
 * Extracts candidate information from Gmail email signatures and threads
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

    const { emailId, emailContent, emailSignature } = await req.json()

    if (!emailContent && !emailId) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'emailContent or emailId is required'),
        { status: 400 }
      )
    }

    // Extract candidate information from email
    const extractedData = {
      name: extractName(emailContent || emailSignature),
      email: extractEmail(emailContent || emailSignature),
      phone: extractPhone(emailContent || emailSignature),
      company: extractCompany(emailContent || emailSignature),
      role: extractRole(emailContent || emailSignature),
      linkedinUrl: extractLinkedInUrl(emailContent || emailSignature),
      skills: extractSkills(emailContent || emailSignature),
      // Metadata
      extractedAt: new Date().toISOString(),
      source: 'Gmail',
    }

    return NextResponse.json({
      success: true,
      profileData: extractedData,
    }, { status: 200 })

  } catch (error) {
    console.error('Gmail extraction error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to extract profile from email'
      ),
      { status: 500 }
    )
  }
}

// Helper functions for extraction
function extractName(text) {
  // Look for patterns like "Best regards, John Doe" or "John Doe" at start
  const patterns = [
    /(?:Best regards|Regards|Thanks|Sincerely)[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractEmail(text) {
  const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi
  const match = text.match(emailPattern)
  return match ? match[0] : null
}

function extractPhone(text) {
  const phonePatterns = [
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /(\+?\d{1,3}[-.\s]?)?\d{10,}/,
  ]
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern)
    if (match) return match[0].trim()
  }
  return null
}

function extractCompany(text) {
  const patterns = [
    /at\s+([A-Z][a-zA-Z\s&]+)/i,
    /([A-Z][a-zA-Z\s&]+)\s+(?:Inc|LLC|Ltd|Corp)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractRole(text) {
  const patterns = [
    /(?:Senior|Junior|Lead|Principal)?\s*(?:Software|Product|Data|DevOps|Full Stack|Frontend|Backend)\s*(?:Engineer|Developer|Manager|Architect|Analyst)/i,
    /(?:VP|Director|Manager|Head|Lead)\s+of\s+([A-Z][a-z]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[0].trim()
  }
  return null
}

function extractLinkedInUrl(text) {
  const linkedinPattern = /(?:linkedin\.com\/in\/|linkedin\.com\/profile\/)([\w-]+)/i
  const match = text.match(linkedinPattern)
  return match ? `https://www.linkedin.com/in/${match[1]}` : null
}

function extractSkills(text) {
  // Look for common skill keywords
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'AWS',
    'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL', 'Git', 'CI/CD',
  ]
  
  const foundSkills = commonSkills.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  )
  
  return foundSkills.length > 0 ? foundSkills : null
}

