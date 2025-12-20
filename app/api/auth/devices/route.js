import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { getUserDevices, trustDevice, revokeDevice } from '../../../../lib/auth/devices.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { logSecurityEvent, AUDIT_ACTIONS } from '../../../../lib/audit.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/devices
 * Get all devices for current user
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const devices = await getUserDevices(session.user.id)

    // Format response
    const safeDevices = devices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      os: device.os,
      browser: device.browser,
      isTrusted: device.isTrusted,
      lastSeenAt: device.lastSeenAt,
      firstSeenAt: device.firstSeenAt,
      activeSessions: device.Sessions?.length || 0,
      sessions: device.Sessions?.map(s => ({
        id: s.id,
        lastActivityAt: s.lastActivityAt,
        ipAddress: s.ipAddress
      })) || []
    }))

    return NextResponse.json({
      success: true,
      devices: safeDevices
    })
  } catch (error) {
    console.error('Get devices error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to get devices'),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/auth/devices
 * Trust or revoke a device
 */
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { deviceId, action } = await req.json()

    if (!deviceId || !action) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Device ID and action are required'),
        { status: 400 }
      )
    }

    if (action === 'trust') {
      await trustDevice(deviceId, session.user.id)
      
      await logSecurityEvent({
        userId: session.user.id,
        action: AUDIT_ACTIONS.DEVICE_TRUSTED,
        req,
        metadata: {
          deviceId
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Device trusted successfully'
      })
    }

    if (action === 'revoke') {
      await revokeDevice(deviceId, session.user.id)
      
      await logSecurityEvent({
        userId: session.user.id,
        action: AUDIT_ACTIONS.DEVICE_REVOKED,
        req,
        metadata: {
          deviceId
        },
        riskScore: 20
      })

      return NextResponse.json({
        success: true,
        message: 'Device access revoked successfully'
      })
    }

    return NextResponse.json(
      createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid action. Use "trust" or "revoke"'),
      { status: 400 }
    )
  } catch (error) {
    console.error('Device action error:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to perform device action'),
      { status: 500 }
    )
  }
}

