import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { exchangeGmailCode } from '../../../../lib/gmail/client.js'
import { prisma } from '../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail/callback
 * Handle Gmail OAuth callback
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
    const tokens = await exchangeGmailCode(code)

    // Save or update integration
    await prisma.gmailIntegration.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.tokenExpiry,
        email: tokens.email,
        isActive: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.tokenExpiry,
        email: tokens.email,
        isActive: true,
      },
    })

    return NextResponse.redirect(
      new URL('/settings/integrations?success=gmail_connected', req.url)
    )
  } catch (error) {
    console.error('Gmail OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(error.message)}`, req.url)
    )
  }
}

