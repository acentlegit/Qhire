import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { getGoogleAuthUrl } from '../../../../../lib/calendar/google.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/google/auth
 * Initiate Google Calendar OAuth flow
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

    const authUrl = getGoogleAuthUrl()
    
    // Store state in session or return URL directly
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to initiate Google OAuth'
      ),
      { status: 500 }
    )
  }
}
