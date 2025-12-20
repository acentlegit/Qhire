import { prisma } from './db.js'

/**
 * Enhanced Audit Logging Service (UAM Integration)
 * HIPAA-compliant audit trail with security event tracking
 */

// Audit event types
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFIED: 'MFA_VERIFIED',
  MFA_FAILED: 'MFA_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // Data Access
  DATA_VIEWED: 'DATA_VIEWED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_DELETED: 'DATA_DELETED',
  
  // CRUD Operations
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  MOVED: 'MOVED',
  
  // Security
  PERMISSION_CHANGED: 'PERMISSION_CHANGED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  DEVICE_TRUSTED: 'DEVICE_TRUSTED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  
  // System
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED'
}

// Severity levels
export const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
}

/**
 * Get client IP address from request
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  const realIp = req.headers['x-real-ip']
  const remoteAddress = req.socket?.remoteAddress
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (remoteAddress) {
    return remoteAddress
  }
  return 'unknown'
}

/**
 * Get user agent from request
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown'
}

/**
 * Calculate severity based on action and context
 */
function calculateSeverity(action, metadata = {}) {
  const criticalActions = [
    AUDIT_ACTIONS.DATA_DELETED,
    AUDIT_ACTIONS.PERMISSION_CHANGED,
    AUDIT_ACTIONS.ROLE_CHANGED,
    AUDIT_ACTIONS.LOGIN_FAILED
  ]
  
  const highActions = [
    AUDIT_ACTIONS.DATA_EXPORTED,
    AUDIT_ACTIONS.PASSWORD_CHANGED,
    AUDIT_ACTIONS.MFA_DISABLED,
    AUDIT_ACTIONS.SESSION_REVOKED
  ]
  
  if (criticalActions.includes(action) || metadata.riskScore > 80) {
    return SEVERITY.CRITICAL
  }
  if (highActions.includes(action) || metadata.riskScore > 50) {
    return SEVERITY.HIGH
  }
  if (metadata.riskScore > 20) {
    return SEVERITY.MEDIUM
  }
  return SEVERITY.LOW
}

/**
 * Enhanced audit logging with security context
 * @param {Object} params
 * @param {string} params.userId - User ID who performed the action
 * @param {string} params.action - Action type (from AUDIT_ACTIONS)
 * @param {string} params.entityType - Entity type (JOB, CANDIDATE, APPLICATION, USER, etc.)
 * @param {string} params.entityId - ID of the entity
 * @param {string} [params.applicationId] - Optional application ID if related
 * @param {Object} [params.changes] - Before/after values
 * @param {Object} [params.metadata] - Additional context
 * @param {Object} [params.req] - Request object (for IP, userAgent)
 * @param {number} [params.riskScore] - Risk assessment score (0-100)
 */
export async function logAuditEvent({
  userId,
  action,
  entityType,
  entityId,
  applicationId = null,
  changes = null,
  metadata = null,
  req = null,
  riskScore = null
}) {
  try {
    // Extract IP and user agent from request if provided
    const ipAddress = req ? getClientIp(req) : metadata?.ipAddress || null
    const userAgent = req ? getUserAgent(req) : metadata?.userAgent || null
    
    // Merge metadata
    const enhancedMetadata = {
      ...metadata,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    }
    
    // Calculate severity
    const severity = calculateSeverity(action, { riskScore, ...enhancedMetadata })
    
    // Create audit log entry
    await prisma.activityLog.create({
      data: {
        userId,
        applicationId,
        action,
        entityType,
        entityId,
        changes,
        metadata: enhancedMetadata,
        ipAddress,
        userAgent,
        riskScore,
        severity
      }
    })
    
    // Log critical events to console for immediate attention
    if (severity === SEVERITY.CRITICAL) {
      console.error('🚨 CRITICAL AUDIT EVENT:', {
        userId,
        action,
        entityType,
        entityId,
        riskScore,
        ipAddress,
        userAgent
      })
      
      // Send email notification for critical events
      try {
        const { sendSecurityAlertEmail } = await import('./email/security.js')
        const { prisma } = await import('./db.js')
        
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
          })
          
          if (user) {
            await sendSecurityAlertEmail(user.email, user.name, {
              action,
              timestamp: new Date().toISOString(),
              ipAddress,
              riskScore,
              entityType,
              entityId
            })
          }
        }
      } catch (emailError) {
        console.error('Failed to send security alert email:', emailError)
        // Don't throw - email failure shouldn't break audit logging
      }
    }
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    // But log the error for monitoring
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent({
  userId,
  action,
  success = true,
  req = null,
  metadata = null,
  riskScore = null
}) {
  return logAuditEvent({
    userId,
    action,
    entityType: 'USER',
    entityId: userId || 'unknown',
    metadata: {
      ...metadata,
      success,
      eventType: 'AUTHENTICATION'
    },
    req,
    riskScore
  })
}

/**
 * Log data access events (HIPAA compliance)
 */
export async function logDataAccess({
  userId,
  entityType,
  entityId,
  action = AUDIT_ACTIONS.DATA_VIEWED,
  req = null,
  metadata = null
}) {
  return logAuditEvent({
    userId,
    action,
    entityType,
    entityId,
    metadata: {
      ...metadata,
      eventType: 'DATA_ACCESS',
      sensitiveData: true
    },
    req
  })
}

/**
 * Log security events
 */
export async function logSecurityEvent({
  userId,
  action,
  req = null,
  metadata = null,
  riskScore = null
}) {
  return logAuditEvent({
    userId,
    action,
    entityType: 'SECURITY',
    entityId: userId || 'system',
    metadata: {
      ...metadata,
      eventType: 'SECURITY'
    },
    req,
    riskScore
  })
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs({
  userId = null,
  action = null,
  entityType = null,
  severity = null,
  startDate = null,
  endDate = null,
  page = 1,
  limit = 50
}) {
  const where = {}
  
  if (userId) where.userId = userId
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (severity) where.severity = severity
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate)
  }
  
  const skip = (page - 1) * limit
  
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    }),
    prisma.activityLog.count({ where })
  ])
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Generate audit report
 */
export async function generateAuditReport({
  startDate,
  endDate,
  userId = null,
  severity = null
}) {
  const where = {
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    }
  }
  
  if (userId) where.userId = userId
  if (severity) where.severity = severity
  
  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  })
  
  // Generate statistics
  const stats = {
    total: logs.length,
    byAction: {},
    bySeverity: {},
    byUser: {},
    criticalEvents: logs.filter(l => l.severity === SEVERITY.CRITICAL).length,
    highRiskEvents: logs.filter(l => l.riskScore && l.riskScore > 50).length
  }
  
  logs.forEach(log => {
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1
    if (log.userId) {
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1
    }
  })
  
  return {
    period: { startDate, endDate },
    logs,
    statistics: stats
  }
}

