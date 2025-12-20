import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { fetchEmails, fetchCandidateEmails, extractCandidateFromEmail } from '../../../../lib/gmail/client.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail/emails
 * Fetch emails from connected Gmail account
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
    const type = searchParams.get('type') || 'all' // 'all' or 'candidates'
    const days = parseInt(searchParams.get('days') || '30')
    const maxResults = parseInt(searchParams.get('maxResults') || '20')
    const query = searchParams.get('query') || ''

    let emails
    if (type === 'candidates') {
      emails = await fetchCandidateEmails(session.user.id, { days, maxResults })
    } else {
      emails = await fetchEmails(session.user.id, { query, maxResults })
    }

    // Extract candidate info from each email
    const emailsWithCandidates = emails.map(email => ({
      ...email,
      candidateInfo: extractCandidateFromEmail(email),
    }))

    return NextResponse.json({
      success: true,
      count: emails.length,
      emails: emailsWithCandidates,
    })

  } catch (error) {
    console.error('Gmail fetch error:', error)
    
    let errorMessage = error.message || 'Failed to fetch emails'
    let statusCode = 500
    
    if (errorMessage.includes('not connected')) {
      errorMessage = 'Gmail not connected. Please connect your Gmail account in Settings > Integrations.'
      statusCode = 400
    }
    
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, errorMessage),
      { status: statusCode }
    )
  }
}

/**
 * POST /api/gmail/emails
 * Import candidates from emails
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

    const { emailIds } = await req.json()

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'emailIds array is required'),
        { status: 400 }
      )
    }

    // Fetch the selected emails
    const emails = await fetchEmails(session.user.id, { 
      query: `rfc822msgid:${emailIds.join(' OR rfc822msgid:')}`,
      maxResults: emailIds.length 
    })

    const candidates = []
    const errors = []

    for (const email of emails) {
      try {
        const candidateInfo = extractCandidateFromEmail(email)
        
        // Check if candidate already exists
        const existing = await prisma.candidate.findFirst({
          where: { email: candidateInfo.email }
        })

        if (existing) {
          errors.push({
            email: candidateInfo.email,
            error: 'Candidate already exists',
          })
          continue
        }

        // Create candidate
        const candidate = await prisma.candidate.create({
          data: {
            name: candidateInfo.name,
            email: candidateInfo.email,
            phone: candidateInfo.phone,
            linkedinUrl: candidateInfo.linkedinUrl,
            source: 'GMAIL',
            status: 'NEW',
            createdById: session.user.id,
          },
        })

        candidates.push(candidate)
      } catch (err) {
        errors.push({
          emailId: email.id,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      imported: candidates.length,
      candidates,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('Gmail import error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to import candidates'),
      { status: 500 }
    )
  }
}

