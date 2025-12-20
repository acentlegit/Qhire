import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export const dynamic = 'force-dynamic'

/**
 * GET /api/livekit/test-token
 * Test endpoint to verify LiveKit token generation
 */
export async function GET(req) {
  try {
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
    const LIVEKIT_SECRET = process.env.LIVEKIT_SECRET
    const LIVEKIT_URL = process.env.LIVEKIT_URL

    if (!LIVEKIT_API_KEY || !LIVEKIT_SECRET) {
      return NextResponse.json({
        error: 'LiveKit credentials not configured',
        hasKey: !!LIVEKIT_API_KEY,
        hasSecret: !!LIVEKIT_SECRET
      }, { status: 500 })
    }

    // Generate a test token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
      identity: 'test-user'
    })

    at.addGrant({
      roomJoin: true,
      room: 'test-room',
      canPublish: true
    })

    // toJwt() is async in newer versions of livekit-server-sdk
    const token = await at.toJwt()
    const tokenStr = typeof token === 'string' ? token : String(token)

    return NextResponse.json({
      success: true,
      hasToken: !!token,
      tokenType: typeof token,
      tokenLength: tokenStr?.length,
      tokenPreview: tokenStr?.substring ? tokenStr.substring(0, 50) + '...' : 'N/A',
      url: LIVEKIT_URL,
      keyPrefix: LIVEKIT_API_KEY?.substring(0, 5),
      secretLength: LIVEKIT_SECRET?.length,
      tokenValue: tokenStr?.substring(0, 100) // Show first 100 chars for debugging
    })
  } catch (error) {
    console.error('Test token error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

