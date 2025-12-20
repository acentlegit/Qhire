/**
 * Gmail API Client
 * Provides Gmail OAuth and email fetching functionality
 */

import { google } from 'googleapis'
import { prisma } from '../db.js'

// Gmail OAuth configuration
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/gmail/callback`

/**
 * Get Gmail OAuth2 client
 */
export function getGmailOAuth2Client() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    throw new Error('Gmail OAuth credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env')
  }

  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  )
}

/**
 * Get Gmail authorization URL
 */
export function getGmailAuthUrl() {
  const oauth2Client = getGmailOAuth2Client()

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata',
  ]

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGmailCode(code) {
  const oauth2Client = getGmailOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  // Get user info
  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email: userInfo.data.email,
  }
}

/**
 * Get Gmail API client for a user
 */
export async function getGmailClient(userId) {
  const integration = await prisma.gmailIntegration.findUnique({
    where: { userId }
  })

  if (!integration || !integration.isActive) {
    throw new Error('Gmail not connected. Please connect your Gmail account first.')
  }

  const oauth2Client = getGmailOAuth2Client()
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiry ? integration.tokenExpiry.getTime() : null,
  })

  // Refresh token if expired
  if (integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()

      await prisma.gmailIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || integration.refreshToken,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      })

      oauth2Client.setCredentials(credentials)
    } catch (error) {
      console.error('Failed to refresh Gmail token:', error)
      throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.')
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * Fetch emails from Gmail
 */
export async function fetchEmails(userId, options = {}) {
  const gmail = await getGmailClient(userId)

  const { query = '', maxResults = 20, labelIds = ['INBOX'] } = options

  // Search for emails
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    labelIds,
  })

  if (!listResponse.data.messages) {
    return []
  }

  // Fetch full email details
  const emails = await Promise.all(
    listResponse.data.messages.map(async (msg) => {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })
      return parseEmail(email.data)
    })
  )

  return emails
}

/**
 * Fetch emails that might contain resumes/job applications
 */
export async function fetchCandidateEmails(userId, options = {}) {
  const { days = 30, maxResults = 50 } = options

  // Search queries for candidate emails
  const searchQueries = [
    'subject:(resume OR CV OR application OR "job application")',
    'has:attachment filename:(pdf OR doc OR docx)',
    'subject:(interested OR applying OR opportunity)',
  ]

  const combinedQuery = `newer_than:${days}d (${searchQueries.join(' OR ')})`

  return fetchEmails(userId, {
    query: combinedQuery,
    maxResults,
    labelIds: ['INBOX'],
  })
}

/**
 * Parse email data from Gmail API response
 */
function parseEmail(emailData) {
  const headers = emailData.payload?.headers || []
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

  // Extract body text
  let bodyText = ''
  if (emailData.payload?.body?.data) {
    bodyText = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8')
  } else if (emailData.payload?.parts) {
    const textPart = emailData.payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
    }
  }

  // Extract attachments
  const attachments = []
  if (emailData.payload?.parts) {
    for (const part of emailData.payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
          size: part.body.size,
        })
      }
    }
  }

  return {
    id: emailData.id,
    threadId: emailData.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    snippet: emailData.snippet,
    bodyText,
    attachments,
    labels: emailData.labelIds || [],
  }
}

/**
 * Download attachment from Gmail
 */
export async function downloadAttachment(userId, messageId, attachmentId) {
  const gmail = await getGmailClient(userId)

  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })

  if (!response.data.data) {
    throw new Error('Attachment not found')
  }

  return Buffer.from(response.data.data, 'base64')
}

/**
 * Extract candidate info from email
 */
export function extractCandidateFromEmail(email) {
  const fromMatch = email.from?.match(/(?:"?([^"<]+)"?\s*)?<?([^>]+@[^>]+)>?/)
  const name = fromMatch?.[1]?.trim() || fromMatch?.[2]?.split('@')[0] || 'Unknown'
  const emailAddress = fromMatch?.[2]?.trim()

  // Extract phone from body
  const phoneMatch = email.bodyText?.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  const phone = phoneMatch?.[0] || null

  // Extract LinkedIn URL from body
  const linkedinMatch = email.bodyText?.match(/linkedin\.com\/in\/[\w-]+/)
  const linkedinUrl = linkedinMatch ? `https://www.${linkedinMatch[0]}` : null

  // Check for resume attachment
  const resumeAttachment = email.attachments?.find(a => 
    /\.(pdf|doc|docx)$/i.test(a.filename) &&
    /resume|cv/i.test(a.filename)
  )

  return {
    name,
    email: emailAddress,
    phone,
    linkedinUrl,
    source: 'GMAIL',
    hasResume: !!resumeAttachment,
    resumeAttachment,
    originalEmail: {
      id: email.id,
      subject: email.subject,
      date: email.date,
    },
  }
}

