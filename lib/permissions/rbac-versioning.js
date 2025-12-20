/**
 * RBAC Policy Versioning Service
 * Tracks changes to role permissions over time and allows rollback
 */

import { prisma } from '../db.js'

/**
 * Save a new version of RBAC permissions for a role
 * @param {string} role - Role name (ADMIN, RECRUITER, etc.)
 * @param {Object} permissions - Permissions object (from ROLE_SCOPES)
 * @param {string} createdBy - User ID who made the change
 * @returns {Promise<number>} New version number
 */
export async function saveRBACVersion(role, permissions, createdBy) {
  try {
    // Get current max version for this role
    const maxVersion = await prisma.rBACPolicyVersion.findFirst({
      where: { role },
      orderBy: { version: 'desc' },
      select: { version: true }
    })

    const newVersion = (maxVersion?.version || 0) + 1

    // Save new version
    await prisma.rBACPolicyVersion.create({
      data: {
        role,
        permissions: JSON.parse(JSON.stringify(permissions)), // Deep clone
        version: newVersion,
        createdBy
      }
    })

    return newVersion
  } catch (error) {
    console.error('Failed to save RBAC version:', error)
    throw error
  }
}

/**
 * Get all versions for a role
 * @param {string} role - Role name
 * @returns {Promise<Array>} Array of version records
 */
export async function getRBACVersions(role) {
  try {
    const versions = await prisma.rBACPolicyVersion.findMany({
      where: { role },
      orderBy: { version: 'desc' }
    })

    // Fetch user info for createdBy if available
    const versionsWithUsers = await Promise.all(
      versions.map(async (version) => {
        if (version.createdBy) {
          try {
            const user = await prisma.user.findUnique({
              where: { id: version.createdBy },
              select: { name: true, email: true }
            })
            return { ...version, createdByUser: user }
          } catch {
            return version
          }
        }
        return version
      })
    )

    return versionsWithUsers
  } catch (error) {
    console.error('Failed to get RBAC versions:', error)
    throw error
  }
}

/**
 * Get a specific version of RBAC permissions
 * @param {string} role - Role name
 * @param {number} version - Version number
 * @returns {Promise<Object|null>} Version record or null
 */
export async function getRBACVersion(role, version) {
  try {
    const versionRecord = await prisma.rBACPolicyVersion.findUnique({
      where: {
        role_version: {
          role,
          version
        }
      }
    })

    return versionRecord
  } catch (error) {
    console.error('Failed to get RBAC version:', error)
    throw error
  }
}

/**
 * Rollback to a previous version of RBAC permissions
 * Note: This returns the permissions object. The actual RBAC system
 * would need to be updated separately to apply these permissions.
 * @param {string} role - Role name
 * @param {number} version - Version to rollback to
 * @returns {Promise<Object>} Permissions object from that version
 */
export async function rollbackRBAC(role, version) {
  try {
    const policy = await prisma.rBACPolicyVersion.findUnique({
      where: {
        role_version: {
          role,
          version
        }
      }
    })

    if (!policy) {
      throw new Error(`Version ${version} not found for role ${role}`)
    }

    // Return permissions (caller should apply these to the RBAC system)
    return policy.permissions
  } catch (error) {
    console.error('Failed to rollback RBAC:', error)
    throw error
  }
}

/**
 * Get the latest version for a role
 * @param {string} role - Role name
 * @returns {Promise<Object|null>} Latest version record or null
 */
export async function getLatestRBACVersion(role) {
  try {
    const version = await prisma.rBACPolicyVersion.findFirst({
      where: { role },
      orderBy: { version: 'desc' }
    })

    return version
  } catch (error) {
    console.error('Failed to get latest RBAC version:', error)
    throw error
  }
}

