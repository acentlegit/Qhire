/**
 * Sentry Error Monitoring Setup
 * 
 * Installation:
 * npm install @sentry/nextjs
 * 
 * Environment Variables:
 * SENTRY_DSN=your_sentry_dsn
 * SENTRY_AUTH_TOKEN=your_auth_token (for releases)
 * 
 * Setup:
 * npx @sentry/wizard@latest -i nextjs
 */

let sentryInitialized = false

/**
 * Initialize Sentry
 */
export function initSentry() {
  if (sentryInitialized || typeof window === 'undefined') {
    return
  }

  try {
    const Sentry = require('@sentry/nextjs')

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0, // Adjust in production
      debug: process.env.NODE_ENV === 'development',
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies
          delete event.request.headers?.authorization
        }
        return event
      },
    })

    sentryInitialized = true
    console.log('✅ Sentry initialized')
  } catch (error) {
    console.warn('⚠️  Sentry not available:', error.message)
  }
}

/**
 * Capture exception
 */
export function captureException(error, context = {}) {
  try {
    const Sentry = require('@sentry/nextjs')
    Sentry.captureException(error, {
      extra: context,
    })
  } catch (err) {
    console.error('Failed to capture exception:', err)
  }
}

/**
 * Capture message
 */
export function captureMessage(message, level = 'info') {
  try {
    const Sentry = require('@sentry/nextjs')
    Sentry.captureMessage(message, level)
  } catch (err) {
    console.error('Failed to capture message:', err)
  }
}

/**
 * Set user context
 */
export function setUserContext(user) {
  try {
    const Sentry = require('@sentry/nextjs')
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    })
  } catch (err) {
    console.error('Failed to set user context:', err)
  }
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initSentry()
}

