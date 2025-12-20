import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/status
 * Get status of all integrations
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

    // Check DocuSign configuration
    const docuSignConfigured = !!(
      process.env.DOCUSIGN_INTEGRATION_KEY &&
      process.env.DOCUSIGN_USER_ID &&
      process.env.DOCUSIGN_ACCOUNT_ID
    )

    // Check Email Service (Resend)
    const emailConfigured = !!process.env.RESEND_API_KEY

    // Check Google Calendar
    const googleCalendarConfigured = !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
    )

    // Check Microsoft Calendar
    const microsoftCalendarConfigured = !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET
    )

    // Check LiveKit
    const livekitConfigured = !!(
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_SECRET &&
      process.env.LIVEKIT_URL
    )

    // Check S3
    const s3Configured = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET_NAME
    )

    // Check AI Provider
    const aiConfigured = !!(
      process.env.OPENAI_API_KEY ||
      (process.env.LLM_CORE_URL && process.env.LLM_CORE_API_KEY)
    )

    return NextResponse.json({
      success: true,
      integrations: {
        docuSign: {
          configured: docuSignConfigured,
          status: docuSignConfigured ? 'configured' : 'not_configured'
        },
        email: {
          configured: emailConfigured,
          status: emailConfigured ? 'configured' : 'not_configured'
        },
        googleCalendar: {
          configured: googleCalendarConfigured,
          status: googleCalendarConfigured ? 'configured' : 'not_configured'
        },
        microsoftCalendar: {
          configured: microsoftCalendarConfigured,
          status: microsoftCalendarConfigured ? 'configured' : 'not_configured'
        },
        livekit: {
          configured: livekitConfigured,
          status: livekitConfigured ? 'configured' : 'not_configured'
        },
        s3: {
          configured: s3Configured,
          status: s3Configured ? 'configured' : 'not_configured'
        },
        ai: {
          configured: aiConfigured,
          status: aiConfigured ? 'configured' : 'not_configured'
        }
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching integration status:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch integration status'),
      { status: 500 }
    )
  }
}

