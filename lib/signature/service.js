/**
 * E-Signature Service
 * Handles digital signatures for offer letters
 * Supports: Custom implementation (default) or DocuSign integration
 */

import { prisma } from '../db.js'
import crypto from 'crypto'
import { sendEmail } from '../email/client.js'

// DocuSign configuration (optional)
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID
const DOCUSIGN_BASE_URL = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi'

/**
 * Get signature provider
 */
export function getSignatureProvider() {
  if (DOCUSIGN_INTEGRATION_KEY && DOCUSIGN_USER_ID && DOCUSIGN_ACCOUNT_ID) {
    return 'docusign'
  }
  return 'custom'
}

/**
 * Create signature request for an offer
 * @param {Object} options - Signature options
 * @returns {Promise<Object>} Signature request details
 */
export async function createSignatureRequest({
  offerId,
  signerName,
  signerEmail,
  documentUrl,
  expirationDays = 7,
  message,
}) {
  const provider = getSignatureProvider()

  if (provider === 'docusign') {
    return createDocuSignRequest({
      offerId,
      signerName,
      signerEmail,
      documentUrl,
      expirationDays,
      message,
    })
  }

  // Custom signature implementation
  return createCustomSignatureRequest({
    offerId,
    signerName,
    signerEmail,
    documentUrl,
    expirationDays,
    message,
  })
}

/**
 * Create custom signature request
 */
async function createCustomSignatureRequest({
  offerId,
  signerName,
  signerEmail,
  expirationDays,
  message,
}) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expirationDays)

  // Create signature record
  const signature = await prisma.signature.create({
    data: {
      offerId,
      signerName,
      signerEmail,
      status: 'PENDING',
      token,
      expiresAt,
    },
  })

  // Generate signing URL
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const signingUrl = `${baseUrl}/sign/${token}`

  // Send signing email
  try {
    await sendSignatureEmail({
      to: signerEmail,
      signerName,
      signingUrl,
      expiresAt,
      message,
    })
  } catch (error) {
    console.error('Failed to send signature email:', error)
  }

  // Update offer status
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      expiresAt,
    },
  })

  return {
    provider: 'custom',
    signatureId: signature.id,
    token: signature.token,
    signingUrl,
    status: 'PENDING',
    expiresAt,
  }
}

/**
 * Create DocuSign signature request
 */
async function createDocuSignRequest({
  offerId,
  signerName,
  signerEmail,
  documentUrl,
  expirationDays,
  message,
}) {
  // Get access token (simplified - in production use JWT auth)
  const accessToken = await getDocuSignAccessToken()

  // Create envelope
  const envelope = {
    emailSubject: 'Please sign your offer letter',
    emailBlurb: message || 'Please review and sign the attached offer letter.',
    status: 'sent',
    recipients: {
      signers: [{
        email: signerEmail,
        name: signerName,
        recipientId: '1',
        tabs: {
          signHereTabs: [{ documentId: '1', pageNumber: '1', xPosition: '100', yPosition: '700' }],
          dateSignedTabs: [{ documentId: '1', pageNumber: '1', xPosition: '300', yPosition: '700' }],
        },
      }],
    },
    documents: [{
      documentId: '1',
      name: 'Offer Letter',
      fileExtension: 'pdf',
      documentBase64: await getDocumentBase64(documentUrl),
    }],
  }

  const response = await fetch(
    `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelope),
    }
  )

  if (!response.ok) {
    throw new Error(`DocuSign API error: ${await response.text()}`)
  }

  const data = await response.json()

  // Create local signature record
  const signature = await prisma.signature.create({
    data: {
      offerId,
      signerName,
      signerEmail,
      status: 'PENDING',
      token: data.envelopeId,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
    },
  })

  return {
    provider: 'docusign',
    signatureId: signature.id,
    envelopeId: data.envelopeId,
    status: data.status,
    uri: data.uri,
  }
}

/**
 * Process signature (custom implementation)
 * @param {string} token - Signature token
 * @param {Object} signatureData - Signature data
 */
export async function processSignature(token, signatureData) {
  const signature = await prisma.signature.findUnique({
    where: { token },
    include: { offer: true },
  })

  if (!signature) {
    throw new Error('Signature not found')
  }

  if (signature.status !== 'PENDING') {
    throw new Error(`Signature already ${signature.status.toLowerCase()}`)
  }

  if (new Date() > signature.expiresAt) {
    await prisma.signature.update({
      where: { id: signature.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Signature link has expired')
  }

  // Update signature
  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      status: 'SIGNED',
      signedAt: new Date(),
      signatureUrl: signatureData.signatureImage, // Base64 or URL
      ipAddress: signatureData.ipAddress,
    },
  })

  // Update offer
  await prisma.offer.update({
    where: { id: signature.offerId },
    data: {
      status: 'ACCEPTED',
      signedAt: new Date(),
      signedBy: signature.signerEmail,
    },
  })

  return { success: true, status: 'SIGNED' }
}

/**
 * Decline signature
 */
export async function declineSignature(token, reason) {
  const signature = await prisma.signature.findUnique({
    where: { token },
  })

  if (!signature) {
    throw new Error('Signature not found')
  }

  await prisma.signature.update({
    where: { id: signature.id },
    data: { status: 'DECLINED' },
  })

  await prisma.offer.update({
    where: { id: signature.offerId },
    data: { status: 'DECLINED' },
  })

  return { success: true, status: 'DECLINED' }
}

/**
 * Get signature status
 */
export async function getSignatureStatus(signatureId) {
  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
    include: {
      offer: {
        include: {
          application: {
            include: {
              candidate: { select: { name: true, email: true } },
              job: { select: { title: true } },
            },
          },
        },
      },
    },
  })

  if (!signature) {
    throw new Error('Signature not found')
  }

  // Check expiration
  if (signature.status === 'PENDING' && new Date() > signature.expiresAt) {
    await prisma.signature.update({
      where: { id: signatureId },
      data: { status: 'EXPIRED' },
    })
    signature.status = 'EXPIRED'
  }

  return signature
}

/**
 * Resend signature request
 */
export async function resendSignatureRequest(signatureId) {
  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
  })

  if (!signature) {
    throw new Error('Signature not found')
  }

  if (signature.status !== 'PENDING') {
    throw new Error('Can only resend pending signatures')
  }

  // Generate new token and expiration
  const newToken = crypto.randomBytes(32).toString('hex')
  const newExpiresAt = new Date()
  newExpiresAt.setDate(newExpiresAt.getDate() + 7)

  await prisma.signature.update({
    where: { id: signatureId },
    data: {
      token: newToken,
      expiresAt: newExpiresAt,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const signingUrl = `${baseUrl}/sign/${newToken}`

  await sendSignatureEmail({
    to: signature.signerEmail,
    signerName: signature.signerName,
    signingUrl,
    expiresAt: newExpiresAt,
  })

  return { success: true, newExpiresAt }
}

/**
 * Send signature email
 */
async function sendSignatureEmail({ to, signerName, signingUrl, expiresAt, message }) {
  const subject = 'Action Required: Please Sign Your Offer Letter'
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Offer Letter Ready for Signature</h2>
      
      <p>Dear ${signerName},</p>
      
      ${message ? `<p>${message}</p>` : ''}
      
      <p>Your offer letter is ready for review and signature. Please click the button below to view and sign your offer.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${signingUrl}" 
           style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review & Sign Offer
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This link will expire on ${new Date(expiresAt).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}.
      </p>
      
      <p>If you have any questions, please don't hesitate to reach out.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      
      <p style="color: #999; font-size: 12px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${signingUrl}" style="color: #1e40af;">${signingUrl}</a>
      </p>
    </div>
  `

  await sendEmail({ to, subject, html })
}

/**
 * Helper: Get DocuSign access token
 */
async function getDocuSignAccessToken() {
  // In production, implement JWT authentication
  // For now, return the stored token
  return process.env.DOCUSIGN_ACCESS_TOKEN
}

/**
 * Helper: Get document as base64
 */
async function getDocumentBase64(url) {
  if (!url) return ''
  
  try {
    const response = await fetch(url)
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return ''
  }
}

