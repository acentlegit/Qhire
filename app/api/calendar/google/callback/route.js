import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { exchangeGoogleCode } from '../../../../../lib/calendar/google.js'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/google/callback
 * Handle Google OAuth callback
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, req.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=no_code', req.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code)

    // Save or update integration
    await prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'GOOGLE'
        }
      },
      create: {
        userId: session.user.id,
        provider: 'GOOGLE',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.tokenExpiry,
        providerUserId: tokens.providerUserId,
        isActive: true
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.tokenExpiry,
        providerUserId: tokens.providerUserId,
        isActive: true
      }
    })

    return NextResponse.redirect(
      new URL('/settings/integrations?success=google_connected', req.url)
    )
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    
    // Provide user-friendly error message
    let errorMessage = error.message || 'Failed to connect Google Calendar'
    
    // Check for common configuration errors
    if (errorMessage.includes('not configured') || errorMessage.includes('GOOGLE_CLIENT')) {
      errorMessage = 'Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env file and restart the server.'
    } else if (errorMessage.includes('redirect_uri_mismatch')) {
      errorMessage = 'Redirect URI mismatch. Please check that GOOGLE_REDIRECT_URI in .env matches the redirect URI in Google Cloud Console.'
    } else if (errorMessage.includes('invalid_client')) {
      errorMessage = 'Invalid Google OAuth credentials. Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file.'
    }
    
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(errorMessage)}`, req.url)
    )
  }
}

