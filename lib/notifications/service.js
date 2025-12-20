/**
 * Real-time Notification Service
 * Handles in-app notifications using Server-Sent Events (SSE)
 */

import { prisma } from '../db.js'
import { sendEmail } from '../email/client.js'

// Store active SSE connections
const connections = new Map() // userId -> Set<Response>

/**
 * Add SSE connection for user
 */
export function addConnection(userId, response) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set())
  }
  connections.get(userId).add(response)

  // Clean up on close
  response.on('close', () => {
    connections.get(userId)?.delete(response)
  })
}

/**
 * Remove SSE connection
 */
export function removeConnection(userId, response) {
  connections.get(userId)?.delete(response)
}

/**
 * Send notification to user via SSE
 */
export function sendSSENotification(userId, notification) {
  const userConnections = connections.get(userId)
  if (!userConnections) return

  const data = `data: ${JSON.stringify(notification)}\n\n`
  userConnections.forEach(response => {
    try {
      response.write(data)
    } catch (e) {
      // Connection closed, will be cleaned up
    }
  })
}

/**
 * Notification types
 */
export const NotificationType = {
  APPLICATION_RECEIVED: 'application_received',
  APPLICATION_UPDATED: 'application_updated',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEW_REMINDER: 'interview_reminder',
  OFFER_CREATED: 'offer_created',
  OFFER_SIGNED: 'offer_signed',
  OFFER_DECLINED: 'offer_declined',
  CANDIDATE_MATCHED: 'candidate_matched',
  ASSESSMENT_COMPLETED: 'assessment_completed',
  RESUME_PARSED: 'resume_parsed',
  TASK_ASSIGNED: 'task_assigned',
  SYSTEM: 'system',
}

/**
 * Create and send notification
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  sendEmail: shouldSendEmail = false,
  emailSubject,
}) {
  // Store notification in database
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data,
      read: false,
    },
  })

  // Send via SSE
  sendSSENotification(userId, {
    type: 'notification',
    notification: {
      id: notification.id,
      type,
      title,
      message,
      data,
      createdAt: notification.createdAt,
    },
  })

  // Send email if requested
  if (shouldSendEmail) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: emailSubject || title,
          html: generateEmailHtml(title, message, data),
        })
      }
    } catch (error) {
      console.error('Failed to send notification email:', error)
    }
  }

  return notification
}

/**
 * Create notification for multiple users
 */
export async function createBulkNotifications({
  userIds,
  type,
  title,
  message,
  data = {},
}) {
  const notifications = await Promise.all(
    userIds.map(userId =>
      createNotification({ userId, type, title, message, data })
    )
  )
  return notifications
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  })
}

/**
 * Mark all notifications as read for user
 */
export async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
}

/**
 * Get user notifications
 */
export async function getUserNotifications(userId, options = {}) {
  const { limit = 20, offset = 0, unreadOnly = false } = options

  const where = { userId }
  if (unreadOnly) where.read = false

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ])

  return { notifications, total, unreadCount }
}

/**
 * Delete old notifications
 */
export async function cleanupOldNotifications(daysOld = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  return prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      read: true,
    },
  })
}

/**
 * Generate notification email HTML
 */
function generateEmailHtml(title, message, data) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">QHire</h1>
      </div>
      <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
        <p style="color: #4b5563; line-height: 1.6;">${message}</p>
        ${data.actionUrl ? `
          <div style="margin-top: 20px;">
            <a href="${data.actionUrl}" 
               style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${data.actionText || 'View Details'}
            </a>
          </div>
        ` : ''}
      </div>
      <div style="padding: 15px 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          This notification was sent from QHire. 
          <a href="${process.env.NEXTAUTH_URL}/settings/notifications" style="color: #1e40af;">Manage preferences</a>
        </p>
      </div>
    </div>
  `
}

// Predefined notification creators for common events

export async function notifyApplicationReceived(application, recruiterId) {
  return createNotification({
    userId: recruiterId,
    type: NotificationType.APPLICATION_RECEIVED,
    title: 'New Application Received',
    message: `${application.candidate?.name || 'A candidate'} has applied for ${application.job?.title || 'a position'}`,
    data: {
      applicationId: application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      actionUrl: `/applications/${application.id}`,
    },
  })
}

export async function notifyInterviewScheduled(event, participantIds) {
  return createBulkNotifications({
    userIds: participantIds,
    type: NotificationType.INTERVIEW_SCHEDULED,
    title: 'Interview Scheduled',
    message: `Interview scheduled for ${new Date(event.start).toLocaleDateString()} at ${new Date(event.start).toLocaleTimeString()}`,
    data: {
      eventId: event.id,
      applicationId: event.applicationId,
      start: event.start,
      actionUrl: `/events/${event.id}`,
    },
  })
}

export async function notifyOfferSigned(offer, recruiterId) {
  return createNotification({
    userId: recruiterId,
    type: NotificationType.OFFER_SIGNED,
    title: 'Offer Signed!',
    message: `Great news! The offer for ${offer.application?.job?.title || 'the position'} has been signed`,
    data: {
      offerId: offer.id,
      applicationId: offer.applicationId,
      actionUrl: `/offers/${offer.id}`,
    },
    sendEmail: true,
    emailSubject: 'Offer Letter Signed - Action Required',
  })
}

export async function notifyAssessmentCompleted(assessment, recruiterId) {
  const scoreText = assessment.score ? ` Score: ${assessment.score}/100` : ''
  return createNotification({
    userId: recruiterId,
    type: NotificationType.ASSESSMENT_COMPLETED,
    title: 'Assessment Completed',
    message: `${assessment.candidate?.name || 'Candidate'} has completed their assessment.${scoreText}`,
    data: {
      assessmentId: assessment.id,
      candidateId: assessment.candidateId,
      score: assessment.score,
      actionUrl: `/assessment/${assessment.id}`,
    },
  })
}

export async function notifyResumesParsed(count, userId) {
  return createNotification({
    userId,
    type: NotificationType.RESUME_PARSED,
    title: 'Resumes Processed',
    message: `${count} resume(s) have been parsed and candidates created`,
    data: {
      count,
      actionUrl: '/candidates',
    },
  })
}

