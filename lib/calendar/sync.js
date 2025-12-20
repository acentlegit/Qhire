import { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from './google.js'
import { createMicrosoftCalendarEvent, updateMicrosoftCalendarEvent, deleteMicrosoftCalendarEvent } from './microsoft.js'
import { prisma } from '../db.js'

/**
 * Sync event to all connected calendars
 */
export async function syncEventToCalendars(userId, event) {
  const integrations = await prisma.calendarIntegration.findMany({
    where: {
      userId,
      isActive: true
    }
  })

  const results = {
    google: null,
    microsoft: null,
    errors: []
  }

  for (const integration of integrations) {
    try {
      const eventData = {
        title: event.title,
        description: event.description || '',
        start: event.start,
        end: event.end,
        timezone: event.timezone || 'UTC',
        location: event.location || '',
        attendees: event.attendees || []
      }

      if (integration.provider === 'GOOGLE') {
        const googleEventId = await createGoogleCalendarEvent(userId, eventData)
        results.google = googleEventId
        
        // Update event with Google event ID
        await prisma.event.update({
          where: { id: event.id },
          data: { googleEventId }
        })
      } else if (integration.provider === 'MICROSOFT') {
        const microsoftEventId = await createMicrosoftCalendarEvent(userId, eventData)
        results.microsoft = microsoftEventId
        
        // Update event with Microsoft event ID
        await prisma.event.update({
          where: { id: event.id },
          data: { microsoftEventId }
        })
      }
    } catch (error) {
      console.error(`Failed to sync to ${integration.provider}:`, error)
      results.errors.push({
        provider: integration.provider,
        error: error.message
      })
    }
  }

  return results
}

/**
 * Update event in all connected calendars
 */
export async function updateEventInCalendars(userId, event) {
  const integrations = await prisma.calendarIntegration.findMany({
    where: {
      userId,
      isActive: true
    }
  })

  const results = {
    updated: [],
    errors: []
  }

  for (const integration of integrations) {
    try {
      const eventData = {
        title: event.title,
        description: event.description || '',
        start: event.start,
        end: event.end,
        timezone: event.timezone || 'UTC',
        location: event.location || '',
        attendees: event.attendees || []
      }

      if (integration.provider === 'GOOGLE' && event.googleEventId) {
        await updateGoogleCalendarEvent(userId, event.googleEventId, eventData)
        results.updated.push('GOOGLE')
      } else if (integration.provider === 'MICROSOFT' && event.microsoftEventId) {
        await updateMicrosoftCalendarEvent(userId, event.microsoftEventId, eventData)
        results.updated.push('MICROSOFT')
      }
    } catch (error) {
      console.error(`Failed to update in ${integration.provider}:`, error)
      results.errors.push({
        provider: integration.provider,
        error: error.message
      })
    }
  }

  return results
}

/**
 * Delete event from all connected calendars
 */
export async function deleteEventFromCalendars(userId, event) {
  const results = {
    deleted: [],
    errors: []
  }

  try {
    if (event.googleEventId) {
      await deleteGoogleCalendarEvent(userId, event.googleEventId)
      results.deleted.push('GOOGLE')
    }
  } catch (error) {
    console.error('Failed to delete from Google:', error)
    results.errors.push({
      provider: 'GOOGLE',
      error: error.message
    })
  }

  try {
    if (event.microsoftEventId) {
      await deleteMicrosoftCalendarEvent(userId, event.microsoftEventId)
      results.deleted.push('MICROSOFT')
    }
  } catch (error) {
    console.error('Failed to delete from Microsoft:', error)
    results.errors.push({
      provider: 'MICROSOFT',
      error: error.message
    })
  }

  return results
}

