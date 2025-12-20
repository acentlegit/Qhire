import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { getMicrosoftAuthUrl } from '../../../../../lib/calendar/microsoft.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/microsoft/auth
 * Initiate Microsoft Calendar OAuth flow
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

    const authUrl = await getMicrosoftAuthUrl()
    
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Microsoft OAuth error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to initiate Microsoft OAuth'
      ),
      { status: 500 }
    )
  }
}

