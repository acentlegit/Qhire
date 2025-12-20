/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * 
 * Use this to initialize monitoring, logging, etc.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize server-side monitoring
    try {
      const { initSentry } = await import('../lib/monitoring/sentry.js')
      initSentry()
    } catch (error) {
      console.warn('Failed to initialize Sentry:', error)
    }
  }
}

