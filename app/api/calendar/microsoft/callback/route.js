import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { exchangeMicrosoftCode } from '../../../../../lib/calendar/microsoft.js'
import { prisma } from '../../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/microsoft/callback
 * Handle Microsoft OAuth callback
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
    const tokens = await exchangeMicrosoftCode(code)

    // Save or update integration
    await prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: 'MICROSOFT'
        }
      },
      create: {
        userId: session.user.id,
        provider: 'MICROSOFT',
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
      new URL('/settings/integrations?success=microsoft_connected', req.url)
    )
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(error.message)}`, req.url)
    )
  }
}

