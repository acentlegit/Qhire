/**
 * Email Client Service
 * Provides a unified interface for sending emails using Resend
 */

import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'QHire <noreply@qhire.com>'

let resendClient = null

/**
 * Get or create Resend client
 */
function getResendClient() {
  if (!resendClient && RESEND_API_KEY) {
    resendClient = new Resend(RESEND_API_KEY)
  }
  return resendClient
}

/**
 * Check if email is configured
 */
export function isEmailConfigured() {
  return !!RESEND_API_KEY
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content
 * @param {string} [options.from] - Sender email
 */
export async function sendEmail({ to, subject, html, text, from }) {
  const client = getResendClient()

  if (!client) {
    console.warn('Email not configured. Set RESEND_API_KEY in .env')
    // In development, just log the email
    console.log('📧 Email would be sent:')
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)
    return { success: true, mock: true }
  }

  try {
    const result = await client.emails.send({
      from: from || FROM_EMAIL,
      to,
      subject,
      html,
      text,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Email send error:', error)
    throw error
  }
}

/**
 * Send email to multiple recipients
 */
export async function sendBulkEmail({ recipients, subject, html, text, from }) {
  const results = await Promise.allSettled(
    recipients.map(to => sendEmail({ to, subject, html, text, from }))
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return { successful, failed, total: recipients.length }
}

/**
 * Send templated email
 */
export async function sendTemplatedEmail({ to, template, data }) {
  const templates = {
    welcome: {
      subject: 'Welcome to QHire!',
      html: (data) => `
        <h1>Welcome to QHire, ${data.name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>Get started by exploring our features.</p>
      `,
    },
    interview_scheduled: {
      subject: 'Interview Scheduled',
      html: (data) => `
        <h1>Interview Scheduled</h1>
        <p>Your interview for ${data.jobTitle} has been scheduled.</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time}</p>
        ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      `,
    },
    offer_sent: {
      subject: 'Offer Letter from QHire',
      html: (data) => `
        <h1>Congratulations, ${data.name}!</h1>
        <p>We are pleased to offer you the position of ${data.jobTitle}.</p>
        <p>Please review and sign your offer letter using the link below:</p>
        <a href="${data.signingUrl}">Review & Sign Offer</a>
      `,
    },
    application_received: {
      subject: 'Application Received',
      html: (data) => `
        <h1>Thank you for applying!</h1>
        <p>We have received your application for ${data.jobTitle}.</p>
        <p>Our team will review your application and get back to you soon.</p>
      `,
    },
  }

  const templateConfig = templates[template]
  if (!templateConfig) {
    throw new Error(`Unknown email template: ${template}`)
  }

  return sendEmail({
    to,
    subject: templateConfig.subject,
    html: templateConfig.html(data),
  })
}

