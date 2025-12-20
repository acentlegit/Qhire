import { ConfidentialClientApplication } from '@azure/msal-node'
import { prisma } from '../db.js'

/**
 * Get Microsoft MSAL client
 */
export function getMicrosoftMSALClient() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/calendar/microsoft/callback`

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured')
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri
    }
  })
}

/**
 * Get Microsoft Graph API access token for a user
 */
export async function getMicrosoftAccessToken(userId) {
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'MICROSOFT'
      }
    }
  })

  if (!integration || !integration.isActive) {
    throw new Error('Microsoft Calendar not connected')
  }

  // Check if token is expired
  if (integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date()) {
    // Refresh token
    const msalClient = getMicrosoftMSALClient()
    
    try {
      const result = await msalClient.acquireTokenByRefreshToken({
        refreshToken: integration.refreshToken,
        scopes: ['https://graph.microsoft.com/Calendars.ReadWrite']
      })

      // Update tokens in database
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: result.accessToken,
          refreshToken: result.account?.idTokenClaims?.refreshToken || integration.refreshToken,
          tokenExpiry: result.expiresOn ? new Date(result.expiresOn.getTime()) : null
        }
      })

      return result.accessToken
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error)
      throw new Error('Failed to refresh Microsoft Calendar token')
    }
  }

  return integration.accessToken
}

/**
 * Make Microsoft Graph API request
 */
async function microsoftGraphRequest(userId, method, endpoint, body = null) {
  const accessToken = await getMicrosoftAccessToken(userId)
  const baseUrl = 'https://graph.microsoft.com/v1.0'

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Microsoft Graph API error: ${error}`)
  }

  return response.json()
}

/**
 * Create event in Microsoft Calendar
 */
export async function createMicrosoftCalendarEvent(userId, eventData) {
  const event = {
    subject: eventData.title,
    body: {
      contentType: 'HTML',
      content: eventData.description || ''
    },
    start: {
      dateTime: new Date(eventData.start).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    end: {
      dateTime: new Date(eventData.end).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    location: {
      displayName: eventData.location || ''
    },
    attendees: eventData.attendees?.map(attendee => ({
      emailAddress: {
        address: attendee.email,
        name: attendee.name
      },
      type: 'required'
    })) || []
  }

  const result = await microsoftGraphRequest(userId, 'POST', '/me/events', event)
  return result.id
}

/**
 * Update event in Microsoft Calendar
 */
export async function updateMicrosoftCalendarEvent(userId, microsoftEventId, eventData) {
  const event = {
    subject: eventData.title,
    body: {
      contentType: 'HTML',
      content: eventData.description || ''
    },
    start: {
      dateTime: new Date(eventData.start).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    end: {
      dateTime: new Date(eventData.end).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    location: {
      displayName: eventData.location || ''
    },
    attendees: eventData.attendees?.map(attendee => ({
      emailAddress: {
        address: attendee.email,
        name: attendee.name
      },
      type: 'required'
    })) || []
  }

  await microsoftGraphRequest(userId, 'PATCH', `/me/events/${microsoftEventId}`, event)
}

/**
 * Delete event from Microsoft Calendar
 */
export async function deleteMicrosoftCalendarEvent(userId, microsoftEventId) {
  await microsoftGraphRequest(userId, 'DELETE', `/me/events/${microsoftEventId}`)
}

/**
 * Get Microsoft OAuth authorization URL
 */
export async function getMicrosoftAuthUrl() {
  const msalClient = getMicrosoftMSALClient()
  
  const scopes = ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access']
  
  return await msalClient.getAuthCodeUrl({
    scopes,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/calendar/microsoft/callback`
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(code) {
  const msalClient = getMicrosoftMSALClient()
  
  const result = await msalClient.acquireTokenByCode({
    code,
    scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'offline_access'],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/calendar/microsoft/callback`
  })

  // Get user info
  const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${result.accessToken}`
    }
  })
  const userInfo = await userInfoResponse.json()

  return {
    accessToken: result.accessToken,
    refreshToken: result.account?.idTokenClaims?.refreshToken || null,
    tokenExpiry: result.expiresOn ? new Date(result.expiresOn.getTime()) : null,
    providerUserId: userInfo.id,
    email: userInfo.mail || userInfo.userPrincipalName
  }
}

