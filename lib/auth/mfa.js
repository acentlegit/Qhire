import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'

/**
 * Multi-Factor Authentication (MFA) Service
 * TOTP (Time-based One-Time Password) implementation
 */

/**
 * Generate MFA secret for a user
 * @param {Object} user - User object with email
 * @returns {Object} Secret object with base32, otpauth_url, etc.
 */
export function generateMFASecret(user) {
  const secret = speakeasy.generateSecret({
    name: `QHire (${user.email})`,
    issuer: 'QHire',
    length: 20
  })
  
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeUrl: null // Will be generated separately
  }
}

/**
 * Generate QR code data URL for MFA setup
 * @param {string} otpauthUrl - OTP Auth URL
 * @returns {Promise<string>} QR code data URL
 */
export async function generateQRCode(otpauthUrl) {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)
    return qrCodeDataUrl
  } catch (error) {
    console.error('Failed to generate QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Verify MFA token
 * @param {string} secret - Base32 secret
 * @param {string} token - 6-digit token from authenticator app
 * @returns {boolean} True if token is valid
 */
export function verifyMFAToken(secret, token) {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) tolerance
    })
  } catch (error) {
    console.error('MFA verification error:', error)
    return false
  }
}

/**
 * Generate backup codes for MFA
 * @param {number} count - Number of backup codes to generate (default: 10)
 * @returns {string[]} Array of backup codes
 */
export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => {
    // Generate 8-character alphanumeric code
    return crypto.randomBytes(4).toString('hex').toUpperCase()
  })
}

/**
 * Verify backup code
 * @param {string[]} backupCodes - Array of backup codes
 * @param {string} code - Code to verify
 * @returns {Object} { valid: boolean, remainingCodes: string[] }
 */
export function verifyBackupCode(backupCodes, code) {
  if (!Array.isArray(backupCodes) || !code) {
    return { valid: false, remainingCodes: backupCodes || [] }
  }
  
  const normalizedCode = code.toUpperCase().trim()
  const index = backupCodes.findIndex(c => c.toUpperCase() === normalizedCode)
  
  if (index === -1) {
    return { valid: false, remainingCodes: backupCodes }
  }
  
  // Remove used backup code
  const remainingCodes = backupCodes.filter((_, i) => i !== index)
  
  return {
    valid: true,
    remainingCodes
  }
}

/**
 * Check if MFA is required for user
 * @param {Object} user - User object
 * @returns {boolean} True if MFA is enabled and required
 */
export function isMFARequired(user) {
  return user.mfaEnabled === true && user.mfaSecret !== null
}

