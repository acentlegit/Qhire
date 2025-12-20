import { prisma } from '../db.js'
import crypto from 'crypto'

/**
 * Session Management Service (UAM Integration)
 * Handles user sessions, tokens, and device tracking
 */

/**
 * Create a new session for a user
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} [params.deviceId] - Device ID if known
 * @param {string} [params.ipAddress] - IP address
 * @param {string} [params.userAgent] - User agent string
 * @param {string} [params.location] - Location (city, country)
 * @param {number} [params.expiresInHours] - Session expiration in hours (default: 24)
 * @returns {Object} Session object with token and refreshToken
 */
export async function createSession({
  userId,
  deviceId = null,
  ipAddress = null,
  userAgent = null,
  location = null,
  expiresInHours = 24
}) {
  // Generate session token
  const token = crypto.randomBytes(32).toString('hex')
  const refreshToken = crypto.randomBytes(32).toString('hex')
  
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + expiresInHours)
  
  const session = await prisma.session.create({
    data: {
      userId,
      deviceId,
      token,
      refreshToken,
      ipAddress,
      userAgent,
      location,
      expiresAt,
      isActive: true,
      lastActivityAt: new Date()
    }
  })
  
  return {
    id: session.id,
    token,
    refreshToken,
    expiresAt: session.expiresAt
  }
}

/**
 * Get session by token
 * @param {string} token - Session token
 * @returns {Object|null} Session object or null
 */
export async function getSessionByToken(token) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mfaEnabled: true
        }
      },
      device: true
    }
  })
  
  if (!session || !session.isActive) {
    return null
  }
  
  // Check if session is expired
  if (new Date() > session.expiresAt) {
    // Mark as inactive
    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false }
    })
    return null
  }
  
  return session
}

/**
 * Refresh session token
 * @param {string} refreshToken - Refresh token
 * @returns {Object|null} New session tokens or null
 */
export async function refreshSession(refreshToken) {
  const session = await prisma.session.findUnique({
    where: { refreshToken }
  })
  
  if (!session || !session.isActive) {
    return null
  }
  
  // Check if refresh token is expired
  if (new Date() > session.expiresAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false }
    })
    return null
  }
  
  // Generate new tokens
  const newToken = crypto.randomBytes(32).toString('hex')
  const newRefreshToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours
  
  await prisma.session.update({
    where: { id: session.id },
    data: {
      token: newToken,
      refreshToken: newRefreshToken,
      expiresAt,
      lastActivityAt: new Date()
    }
  })
  
  return {
    token: newToken,
    refreshToken: newRefreshToken,
    expiresAt
  }
}

/**
 * Update session last activity
 * @param {string} sessionId - Session ID
 */
export async function updateSessionActivity(sessionId) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: new Date()
    }
  })
}

/**
 * Revoke session
 * @param {string} sessionId - Session ID
 */
export async function revokeSession(sessionId) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      isActive: false
    }
  })
}

/**
 * Revoke all sessions for a user (except current)
 * @param {string} userId - User ID
 * @param {string} [exceptSessionId] - Session ID to keep active
 */
export async function revokeAllUserSessions(userId, exceptSessionId = null) {
  const where = {
    userId,
    isActive: true
  }
  
  if (exceptSessionId) {
    where.id = { not: exceptSessionId }
  }
  
  await prisma.session.updateMany({
    where,
    data: {
      isActive: false
    }
  })
}

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of session objects
 */
export async function getUserSessions(userId) {
  return prisma.session.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() }
    },
    include: {
      device: true
    },
    orderBy: {
      lastActivityAt: 'desc'
    }
  })
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  const result = await prisma.session.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      isActive: true
    },
    data: {
      isActive: false
    }
  })
  
  return result.count
}

