import { prisma } from '../db.js'

/**
 * Enhanced RBAC (Role-Based Access Control) with Scope-based Permissions
 * Provides fine-grained access control beyond simple role checks
 */

// Permission scopes
export const SCOPES = {
  // Jobs
  JOB_VIEW: 'job:view',
  JOB_CREATE: 'job:create',
  JOB_EDIT: 'job:edit',
  JOB_DELETE: 'job:delete',
  JOB_PUBLISH: 'job:publish',
  
  // Candidates
  CANDIDATE_VIEW: 'candidate:view',
  CANDIDATE_CREATE: 'candidate:create',
  CANDIDATE_EDIT: 'candidate:edit',
  CANDIDATE_DELETE: 'candidate:delete',
  
  // Applications
  APPLICATION_VIEW: 'application:view',
  APPLICATION_CREATE: 'application:create',
  APPLICATION_EDIT: 'application:edit',
  APPLICATION_DELETE: 'application:delete',
  APPLICATION_MOVE: 'application:move',
  
  // Offers
  OFFER_VIEW: 'offer:view',
  OFFER_CREATE: 'offer:create',
  OFFER_EDIT: 'offer:edit',
  OFFER_SEND: 'offer:send',
  OFFER_DELETE: 'offer:delete',
  
  // Users
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  
  // Security
  SECURITY_VIEW: 'security:view',
  SECURITY_MANAGE: 'security:manage',
  AUDIT_VIEW: 'audit:view',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  
  // Calendar
  CALENDAR_VIEW: 'calendar:view',
  CALENDAR_EDIT: 'calendar:edit',
}

// Role to scope mapping
const ROLE_SCOPES = {
  ADMIN: [
    // Admins have all permissions
    ...Object.values(SCOPES)
  ],
  RECRUITER: [
    SCOPES.JOB_VIEW,
    SCOPES.JOB_CREATE,
    SCOPES.JOB_EDIT,
    SCOPES.CANDIDATE_VIEW,
    SCOPES.CANDIDATE_CREATE,
    SCOPES.CANDIDATE_EDIT,
    SCOPES.APPLICATION_VIEW,
    SCOPES.APPLICATION_CREATE,
    SCOPES.APPLICATION_EDIT,
    SCOPES.APPLICATION_MOVE,
    SCOPES.OFFER_VIEW,
    SCOPES.OFFER_CREATE,
    SCOPES.OFFER_EDIT,
    SCOPES.OFFER_SEND,
    SCOPES.CALENDAR_VIEW,
    SCOPES.CALENDAR_EDIT,
    SCOPES.ANALYTICS_VIEW,
    SCOPES.SECURITY_VIEW,
  ],
  HIRING_MANAGER: [
    SCOPES.JOB_VIEW,
    SCOPES.CANDIDATE_VIEW,
    SCOPES.APPLICATION_VIEW,
    SCOPES.APPLICATION_EDIT,
    SCOPES.OFFER_VIEW,
    SCOPES.OFFER_CREATE,
    SCOPES.OFFER_EDIT,
    SCOPES.OFFER_SEND,
    SCOPES.CALENDAR_VIEW,
    SCOPES.CALENDAR_EDIT,
  ],
}

/**
 * Check if user has a specific permission scope
 * @param {string} userRole - User's role
 * @param {string} scope - Permission scope to check
 * @returns {boolean} True if user has permission
 */
export function hasScope(userRole, scope) {
  if (!userRole || !scope) return false
  
  const userScopes = ROLE_SCOPES[userRole] || []
  return userScopes.includes(scope)
}

/**
 * Check if user has any of the provided scopes
 * @param {string} userRole - User's role
 * @param {string[]} scopes - Array of permission scopes to check
 * @returns {boolean} True if user has at least one permission
 */
export function hasAnyScope(userRole, scopes) {
  if (!userRole || !scopes || scopes.length === 0) return false
  return scopes.some(scope => hasScope(userRole, scope))
}

/**
 * Check if user has all of the provided scopes
 * @param {string} userRole - User's role
 * @param {string[]} scopes - Array of permission scopes to check
 * @returns {boolean} True if user has all permissions
 */
export function hasAllScopes(userRole, scopes) {
  if (!userRole || !scopes || scopes.length === 0) return false
  return scopes.every(scope => hasScope(userRole, scope))
}

/**
 * Get all scopes for a role
 * @param {string} userRole - User's role
 * @returns {string[]} Array of permission scopes
 */
export function getRoleScopes(userRole) {
  return ROLE_SCOPES[userRole] || []
}

/**
 * Check resource ownership (user can only edit their own resources)
 * @param {string} resourceUserId - User ID who owns the resource
 * @param {string} currentUserId - Current user's ID
 * @param {string} userRole - Current user's role
 * @returns {boolean} True if user can access the resource
 */
export function canAccessResource(resourceUserId, currentUserId, userRole) {
  // Admins can access all resources
  if (userRole === 'ADMIN') return true
  
  // Users can access their own resources
  return resourceUserId === currentUserId
}

/**
 * Middleware function to check permissions
 * @param {Object} options
 * @param {string} options.requiredScope - Required permission scope
 * @param {string} options.userRole - User's role
 * @param {string} [options.resourceUserId] - Resource owner's user ID
 * @param {string} [options.currentUserId] - Current user's ID
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export function checkPermission({ requiredScope, userRole, resourceUserId, currentUserId }) {
  // Check scope permission
  if (!hasScope(userRole, requiredScope)) {
    return {
      allowed: false,
      reason: `User role '${userRole}' does not have permission '${requiredScope}'`
    }
  }

  // Check resource ownership if provided
  if (resourceUserId && currentUserId && resourceUserId !== currentUserId) {
    if (!canAccessResource(resourceUserId, currentUserId, userRole)) {
      return {
        allowed: false,
        reason: 'User does not have access to this resource'
      }
    }
  }

  return { allowed: true }
}

/**
 * Express-style middleware for API routes
 * Usage: await requirePermission(req, SCOPES.JOB_CREATE)
 */
export async function requirePermission(req, requiredScope, options = {}) {
  const session = await import('next-auth/next').then(m => m.getServerSession)
  const { authOptions } = await import('../../lib/auth.js')
  
  const userSession = await session(authOptions)
  
  if (!userSession?.user) {
    throw new Error('Authentication required')
  }

  const { user } = userSession
  const permission = checkPermission({
    requiredScope,
    userRole: user.role,
    resourceUserId: options.resourceUserId,
    currentUserId: user.id
  })

  if (!permission.allowed) {
    throw new Error(permission.reason || 'Permission denied')
  }

  return true
}

