import { Resend } from 'resend'

// Initialize Resend (will use RESEND_API_KEY from env)
// Only initialize if API key is available (prevents build errors)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Send email using Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.from - Sender email (defaults to env or noreply@qhire.com)
 * @returns {Promise<Object>} Resend response
 */
export async function sendEmail({ to, subject, html, from = null }) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set, email not sent')
      return { success: false, error: 'Email service not configured' }
    }

    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'noreply@qhire.com'
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html
    })

    if (error) {
      // Check if it's a domain verification error
      if (error.statusCode === 403 && error.message?.includes('domain is not verified')) {
        console.warn('⚠️ Email not sent: Domain not verified. Stage change still works, but email notifications are disabled.')
        console.warn('   To enable emails: Add and verify a domain in Resend dashboard, or use a verified domain.')
      } else {
        console.error('Resend error:', error)
      }
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email sending error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send interview invitation email
 */
export async function sendInterviewInvite({ 
  candidateEmail, 
  candidateName, 
  jobTitle, 
  interviewDate, 
  interviewTime,
  meetingLink,
  location = null,
  organizerName
}) {
  const date = new Date(interviewDate).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .info-box { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Interview Invitation</h1>
        </div>
        <div class="content">
          <p>Hi ${candidateName},</p>
          
          <p>We're excited to invite you for an interview for the <strong>${jobTitle}</strong> position!</p>
          
          <div class="info-box">
            <h3>Interview Details:</h3>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Time:</strong> ${interviewTime}</p>
            ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
            ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
            ${organizerName ? `<p><strong>Organizer:</strong> ${organizerName}</p>` : ''}
          </div>
          
          ${meetingLink ? `<a href="${meetingLink}" class="button">Join Meeting</a>` : ''}
          
          <p>If you need to reschedule, please let us know as soon as possible.</p>
          
          <p>Best regards,<br>${organizerName || 'QHire Team'}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: candidateEmail,
    subject: `Interview Invitation: ${jobTitle}`,
    html
  })
}

/**
 * Send offer email
 */
export async function sendOfferEmail({
  candidateEmail,
  candidateName,
  jobTitle,
  salary,
  currency = 'USD',
  startDate,
  benefits = null,
  offerLink = null
}) {
  const formattedSalary = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(salary)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; }
        .offer-box { background: white; padding: 20px; border: 2px solid #10b981; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Job Offer</h1>
        </div>
        <div class="content">
          <p>Hi ${candidateName},</p>
          
          <p>We're thrilled to extend an offer for the <strong>${jobTitle}</strong> position!</p>
          
          <div class="offer-box">
            <h2>Offer Details:</h2>
            <p><strong>Position:</strong> ${jobTitle}</p>
            <p><strong>Salary:</strong> ${formattedSalary}</p>
            ${startDate ? `<p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
            ${benefits ? `<p><strong>Benefits:</strong> ${Array.isArray(benefits) ? benefits.join(', ') : benefits}</p>` : ''}
          </div>
          
          ${offerLink ? `<a href="${offerLink}" class="button">View Full Offer</a>` : ''}
          
          <p>Please review the offer details and let us know if you have any questions.</p>
          
          <p>We look forward to welcoming you to the team!</p>
          
          <p>Best regards,<br>QHire Team</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: candidateEmail,
    subject: `Job Offer: ${jobTitle}`,
    html
  })
}

/**
 * Send application status update email
 */
export async function sendStatusUpdateEmail({
  candidateEmail,
  candidateName,
  jobTitle,
  status,
  message = null
}) {
  const statusMessages = {
    'Applied': 'We have received your application',
    'Screen': 'Your application has moved to the screening stage',
    'Interview': 'Congratulations! You have been selected for an interview',
    'Offer': 'Congratulations! We would like to extend an offer',
    'Hired': 'Congratulations! You have been hired',
    'Rejected': 'Thank you for your interest, but we have decided to move forward with other candidates'
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 30px; }
        .status-box { background: white; padding: 15px; border-left: 4px solid #6366f1; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Application Status Update</h1>
        </div>
        <div class="content">
          <p>Hi ${candidateName},</p>
          
          <p>Your application status for <strong>${jobTitle}</strong> has been updated:</p>
          
          <div class="status-box">
            <h3>Status: ${status}</h3>
            <p>${statusMessages[status] || 'Your application status has been updated'}</p>
            ${message ? `<p>${message}</p>` : ''}
          </div>
          
          <p>You can view your application status in your candidate dashboard.</p>
          
          <p>Best regards,<br>QHire Team</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: candidateEmail,
    subject: `Application Update: ${jobTitle} - ${status}`,
    html
  })
}

