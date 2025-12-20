import { google } from 'googleapis'
import { prisma } from '../db.js'

/**
 * Get Google OAuth2 client
 */
export function getGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/calendar/google/callback`

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Get Google Calendar API client for a user
 */
export async function getGoogleCalendarClient(userId) {
  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'GOOGLE'
      }
    }
  })

  if (!integration || !integration.isActive) {
    throw new Error('Google Calendar not connected')
  }

  const oauth2Client = getGoogleOAuth2Client()
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiry ? integration.tokenExpiry.getTime() : null
  })

  // Refresh token if expired
  if (integration.tokenExpiry && new Date(integration.tokenExpiry) < new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      
      // Update tokens in database
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || integration.refreshToken,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
        }
      })

      oauth2Client.setCredentials(credentials)
    } catch (error) {
      console.error('Failed to refresh Google token:', error)
      throw new Error('Failed to refresh Google Calendar token')
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

/**
 * Create event in Google Calendar
 */
export async function createGoogleCalendarEvent(userId, eventData) {
  const calendar = await getGoogleCalendarClient(userId)
  const calendarId = 'primary' // Use primary calendar

  const googleEvent = {
    summary: eventData.title,
    description: eventData.description || '',
    start: {
      dateTime: new Date(eventData.start).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    end: {
      dateTime: new Date(eventData.end).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    location: eventData.location || '',
    attendees: eventData.attendees?.map(attendee => ({
      email: attendee.email,
      displayName: attendee.name
    })) || []
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: googleEvent
  })

  return response.data.id
}

/**
 * Update event in Google Calendar
 */
export async function updateGoogleCalendarEvent(userId, googleEventId, eventData) {
  const calendar = await getGoogleCalendarClient(userId)
  const calendarId = 'primary'

  const googleEvent = {
    summary: eventData.title,
    description: eventData.description || '',
    start: {
      dateTime: new Date(eventData.start).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    end: {
      dateTime: new Date(eventData.end).toISOString(),
      timeZone: eventData.timezone || 'UTC'
    },
    location: eventData.location || '',
    attendees: eventData.attendees?.map(attendee => ({
      email: attendee.email,
      displayName: attendee.name
    })) || []
  }

  await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: googleEvent
  })
}

/**
 * Delete event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(userId, googleEventId) {
  const calendar = await getGoogleCalendarClient(userId)
  const calendarId = 'primary'

  await calendar.events.delete({
    calendarId,
    eventId: googleEventId
  })
}

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl() {
  try {
    const oauth2Client = getGoogleOAuth2Client()
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    })
  } catch (error) {
    console.error('Failed to generate Google auth URL:', error)
    if (error.message?.includes('not configured')) {
      throw new Error('Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env file.')
    }
    throw error
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code) {
  try {
    const oauth2Client = getGoogleOAuth2Client()
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    
    if (!tokens.access_token) {
      throw new Error('Failed to get access token from Google')
    }
    
    // Get user info
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    
    let userInfo
    try {
      userInfo = await oauth2.userinfo.get()
    } catch (error) {
      console.error('Failed to get user info:', error)
      // If user info fails, we can still save the tokens
      // Use a placeholder for providerUserId
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        providerUserId: tokens.access_token.substring(0, 20), // Fallback ID
        email: null
      }
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      providerUserId: userInfo.data.id || tokens.access_token.substring(0, 20),
      email: userInfo.data.email
    }
  } catch (error) {
    console.error('Google OAuth token exchange error:', error)
    
    // Provide more helpful error messages
    if (error.message?.includes('invalid_grant')) {
      throw new Error('Authorization code expired or invalid. Please try connecting again.')
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      throw new Error('Redirect URI mismatch. Please check GOOGLE_REDIRECT_URI in .env matches Google Cloud Console settings.')
    } else if (error.message?.includes('invalid_client')) {
      throw new Error('Invalid Google OAuth credentials. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env')
    } else if (error.message?.includes('missing required authentication credential')) {
      throw new Error('Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env file.')
    }
    
    throw error
  }
}

