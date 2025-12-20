import { prisma } from '../db.js'
import crypto from 'crypto'

/**
 * Device Management Service (UAM Integration)
 * Tracks and manages user devices for security
 */

/**
 * Generate device fingerprint
 * @param {Object} deviceInfo - Device information
 * @returns {string} Device fingerprint hash
 */
export function generateDeviceFingerprint(deviceInfo) {
  const { userAgent, screenWidth, screenHeight, timezone, language } = deviceInfo
  
  const fingerprintString = [
    userAgent || '',
    screenWidth || '',
    screenHeight || '',
    timezone || '',
    language || ''
  ].join('|')
  
  return crypto.createHash('sha256').update(fingerprintString).digest('hex')
}

/**
 * Parse user agent to extract device info
 * @param {string} userAgent - User agent string
 * @returns {Object} Device information
 */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      type: 'unknown',
      os: 'unknown',
      browser: 'unknown'
    }
  }
  
  const ua = userAgent.toLowerCase()
  
  // Detect device type
  let type = 'desktop'
  if (ua.includes('mobile') || ua.includes('android')) {
    type = 'mobile'
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    type = 'tablet'
  }
  
  // Detect OS
  let os = 'unknown'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  
  // Detect browser
  let browser = 'unknown'
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('opera')) browser = 'Opera'
  
  return {
    type,
    os,
    browser
  }
}

/**
 * Find or create device for user
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.userAgent - User agent string
 * @param {Object} [params.deviceInfo] - Additional device info
 * @returns {Object} Device object
 */
export async function findOrCreateDevice({
  userId,
  userAgent,
  deviceInfo = {}
}) {
  // Parse user agent
  const parsed = parseUserAgent(userAgent)
  
  // Generate fingerprint
  const fingerprint = generateDeviceFingerprint({
    userAgent,
    ...deviceInfo
  })
  
  // Try to find existing device
  let device = await prisma.device.findFirst({
    where: {
      userId,
      fingerprint
    }
  })
  
  if (device) {
    // Update last seen
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        os: parsed.os,
        browser: parsed.browser,
        type: parsed.type
      }
    })
  } else {
    // Create new device
    device = await prisma.device.create({
      data: {
        userId,
        fingerprint,
        type: parsed.type,
        os: parsed.os,
        browser: parsed.browser,
        name: `${parsed.os} - ${parsed.browser}`,
        isTrusted: false, // Require user to trust new devices
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    })
  }
  
  return device
}

/**
 * Get all devices for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of device objects
 */
export async function getUserDevices(userId) {
  return prisma.device.findMany({
    where: { userId },
    include: {
      Sessions: {
        where: {
          isActive: true
        },
        select: {
          id: true,
          lastActivityAt: true,
          ipAddress: true
        }
      }
    },
    orderBy: {
      lastSeenAt: 'desc'
    }
  })
}

/**
 * Trust a device
 * @param {string} deviceId - Device ID
 * @param {string} userId - User ID (for verification)
 */
export async function trustDevice(deviceId, userId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId }
  })
  
  if (!device || device.userId !== userId) {
    throw new Error('Device not found or access denied')
  }
  
  return prisma.device.update({
    where: { id: deviceId },
    data: {
      isTrusted: true
    }
  })
}

/**
 * Revoke device access
 * @param {string} deviceId - Device ID
 * @param {string} userId - User ID (for verification)
 */
export async function revokeDevice(deviceId, userId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId }
  })
  
  if (!device || device.userId !== userId) {
    throw new Error('Device not found or access denied')
  }
  
  // Revoke all sessions for this device
  await prisma.session.updateMany({
    where: {
      deviceId,
      isActive: true
    },
    data: {
      isActive: false
    }
  })
  
  // Delete device
  return prisma.device.delete({
    where: { id: deviceId }
  })
}

/**
 * Check if device is trusted
 * @param {string} deviceId - Device ID
 * @returns {boolean} True if device is trusted
 */
export async function isDeviceTrusted(deviceId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { isTrusted: true }
  })
  
  return device?.isTrusted || false
}

