'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Component that initializes a session when user is logged in
 * This ensures sessions and devices are created after login
 */
export default function SessionInitializer() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Initialize session (create if doesn't exist)
      fetch('/api/auth/session/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        // Silently fail - session init is not critical
        console.error('Failed to initialize session:', error)
      })
    }
  }, [status, session])

  return null // This component doesn't render anything
}

