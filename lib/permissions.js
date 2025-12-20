// Role-based permissions helper

export const PERMISSIONS = {
  // Job permissions
  CREATE_JOB: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  EDIT_JOB: ['ADMIN', 'HIRING_MANAGER'],
  DELETE_JOB: ['ADMIN'],
  VIEW_ALL_JOBS: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  
  // Candidate permissions
  CREATE_CANDIDATE: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  EDIT_CANDIDATE: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  DELETE_CANDIDATE: ['ADMIN'],
  VIEW_ALL_CANDIDATES: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  
  // Application permissions
  CREATE_APPLICATION: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  UPDATE_APPLICATION_STAGE: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  DELETE_APPLICATION: ['ADMIN'],
  VIEW_ALL_APPLICATIONS: ['ADMIN', 'RECRUITER', 'HIRING_MANAGER'],
  
  // User management
  MANAGE_USERS: ['ADMIN'],
  VIEW_USERS: ['ADMIN', 'HIRING_MANAGER'],
}

export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false
  const allowedRoles = PERMISSIONS[permission] || []
  return allowedRoles.includes(userRole)
}

export function canCreateJob(role) {
  return hasPermission(role, 'CREATE_JOB')
}

export function canEditJob(role) {
  return hasPermission(role, 'EDIT_JOB')
}

export function canDeleteJob(role) {
  return hasPermission(role, 'DELETE_JOB')
}

export function canManageUsers(role) {
  return hasPermission(role, 'MANAGE_USERS')
}

