/**
 * Retry helper for database operations
 * Handles connection closed errors and transient failures
 */
export async function withRetry(fn, retries = 2, delay = 300) {
  let lastError
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Check if it's a connection error that might be retryable
      const isConnectionError = 
        error?.message?.includes('Closed') ||
        error?.message?.includes('connection') ||
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1002' || // Database server was reached but timed out
        error?.kind === 'Closed'
      
      if (isConnectionError && i < retries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
        continue
      }
      
      // If not retryable or out of retries, throw
      throw error
    }
  }
  throw lastError
}

