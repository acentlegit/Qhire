/**
 * Google Calendar OAuth and integration utilities
 * Basic setup for calendar sync
 */

/**
 * Generate Google Calendar OAuth URL
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {string} OAuth URL
 */
export function getGoogleCalendarAuthUrl(redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID not configured')
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent'
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {Promise<Object>} Token response
 */
export async function exchangeGoogleCalendarCode(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar credentials not configured')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return await response.json()
}

/**
 * Create calendar event in Google Calendar
 * @param {string} accessToken - Google access token
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
export async function createGoogleCalendarEvent(accessToken, eventData) {
  const {
    title,
    description,
    start,
    end,
    location,
    attendees = []
  } = eventData

  const event = {
    summary: title,
    description: description || '',
    start: {
      dateTime: new Date(start).toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: new Date(end).toISOString(),
      timeZone: 'UTC',
    },
    location: location || '',
    attendees: attendees.map(email => ({ email })),
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  return await response.json()
}

/**
 * Generate ICS file content for calendar event
 * @param {Object} eventData - Event data
 * @returns {string} ICS file content
 */
export function generateICSFile(eventData) {
  const {
    title,
    description,
    start,
    end,
    location,
    organizer = 'QHire <noreply@qhire.com>'
  } = eventData

  const formatDate = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QHire//Interview Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@qhire.com`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    `ORGANIZER:${organizer}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n')

  return ics
}

