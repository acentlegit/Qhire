import { prisma } from './db.js'

/**
 * Log an activity to the activity log
 * @param {Object} params
 * @param {string} params.userId - User ID who performed the action
 * @param {string} params.action - Action type (CREATED, UPDATED, MOVED, DELETED, etc.)
 * @param {string} params.entityType - Entity type (JOB, CANDIDATE, APPLICATION, OFFER, etc.)
 * @param {string} params.entityId - ID of the entity
 * @param {string} [params.applicationId] - Optional application ID if related
 * @param {Object} [params.changes] - Before/after values
 * @param {Object} [params.metadata] - Additional context
 */
export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  applicationId = null,
  changes = null,
  metadata = null
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        applicationId,
        action,
        entityType,
        entityId,
        changes,
        metadata
      }
    })
  } catch (error) {
    // Don't throw - activity logging should not break the main operation
    console.error('Failed to log activity:', error)
  }
}

/**
 * Helper to create activity log with before/after changes
 */
export async function logChange({
  userId,
  action,
  entityType,
  entityId,
  applicationId = null,
  before = null,
  after = null,
  metadata = null
}) {
  return logActivity({
    userId,
    action,
    entityType,
    entityId,
    applicationId,
    changes: before && after ? { before, after } : null,
    metadata
  })
}
