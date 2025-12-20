/**
 * Risk Assessment Engine (UAM Integration)
 * Evaluates login attempts and user actions for security risks
 */

/**
 * Evaluate risk score for a login attempt
 * @param {Object} context - Login context
 * @param {boolean} context.newDevice - Is this a new device?
 * @param {boolean} context.newLocation - Is this a new location?
 * @param {string} context.ipReputation - IP reputation (good, neutral, bad)
 * @param {string} context.timeOfDay - Time of login (normal hours vs off-hours)
 * @param {number} context.failedAttempts - Number of recent failed attempts
 * @param {boolean} context.isTrustedDevice - Is device trusted?
 * @param {string} context.userAgent - User agent string
 * @returns {number} Risk score (0-100, higher = more risky)
 */
export function evaluateRisk(context) {
  let score = 0
  
  // New device detection (high risk)
  if (context.newDevice && !context.isTrustedDevice) {
    score += 50
  }
  
  // New location detection (medium risk)
  if (context.newLocation) {
    score += 30
  }
  
  // IP reputation (critical risk)
  if (context.ipReputation === 'bad') {
    score += 80
  } else if (context.ipReputation === 'suspicious') {
    score += 40
  }
  
  // Off-hours login (low risk)
  if (context.timeOfDay === 'off-hours') {
    score += 15
  }
  
  // Failed login attempts (high risk)
  if (context.failedAttempts > 0) {
    score += Math.min(context.failedAttempts * 10, 50)
  }
  
  // Suspicious user agent (medium risk)
  if (context.userAgent && (
    context.userAgent.includes('bot') ||
    context.userAgent.includes('crawler') ||
    context.userAgent.length < 10
  )) {
    score += 25
  }
  
  // Trusted device reduces risk
  if (context.isTrustedDevice) {
    score = Math.max(0, score - 30)
  }
  
  // Cap at 100
  return Math.min(100, Math.max(0, score))
}

/**
 * Get risk level from score
 * @param {number} score - Risk score (0-100)
 * @returns {string} Risk level (LOW, MEDIUM, HIGH, CRITICAL)
 */
export function getRiskLevel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 20) return 'MEDIUM'
  return 'LOW'
}

/**
 * Get recommended action based on risk score
 * @param {number} score - Risk score (0-100)
 * @returns {Object} Recommended action
 */
export function getRecommendedAction(score) {
  if (score >= 80) {
    return {
      action: 'BLOCK',
      requireMFA: true,
      notifyAdmin: true,
      logEvent: true
    }
  }
  
  if (score >= 50) {
    return {
      action: 'REQUIRE_MFA',
      requireMFA: true,
      notifyAdmin: false,
      logEvent: true
    }
  }
  
  if (score >= 20) {
    return {
      action: 'WARN',
      requireMFA: false,
      notifyAdmin: false,
      logEvent: true
    }
  }
  
  return {
    action: 'ALLOW',
    requireMFA: false,
    notifyAdmin: false,
    logEvent: false
  }
}

/**
 * Check IP reputation (simplified - in production, use a service like AbuseIPDB)
 * @param {string} ipAddress - IP address
 * @returns {Promise<string>} Reputation (good, neutral, suspicious, bad)
 */
export async function checkIPReputation(ipAddress) {
  // Simplified check - in production, use a real IP reputation service
  if (!ipAddress || ipAddress === 'unknown' || ipAddress === '127.0.0.1') {
    return 'neutral'
  }
  
  // Check for local/private IPs
  if (
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.16.') ||
    ipAddress === 'localhost'
  ) {
    return 'good'
  }
  
  // TODO: Integrate with IP reputation service
  // For now, return neutral
  return 'neutral'
}

/**
 * Detect if login is during normal business hours
 * @param {Date} date - Date to check
 * @param {string} timezone - Timezone (default: UTC)
 * @returns {string} 'normal' or 'off-hours'
 */
export function detectTimeOfDay(date = new Date(), timezone = 'UTC') {
  const hour = date.getUTCHours()
  
  // Normal business hours: 9 AM - 6 PM UTC
  if (hour >= 9 && hour < 18) {
    return 'normal'
  }
  
  return 'off-hours'
}

