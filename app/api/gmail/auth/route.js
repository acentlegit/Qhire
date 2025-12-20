import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { getGmailAuthUrl } from '../../../../lib/gmail/client.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail/auth
 * Initiate Gmail OAuth flow
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

    const authUrl = getGmailAuthUrl()
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Gmail OAuth error:', error)
    
    let errorMessage = error.message || 'Failed to initiate Gmail OAuth'
    if (errorMessage.includes('not configured')) {
      errorMessage = 'Gmail OAuth credentials not configured. Please add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env file.'
    }
    
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, errorMessage),
      { status: 500 }
    )
  }
}

