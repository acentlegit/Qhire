import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { addConnection, removeConnection } from '../../../../lib/notifications/service.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
export async function GET(req) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`))

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch (e) {
          clearInterval(keepAlive)
        }
      }, 30000)

      // Custom response-like object to work with SSE service
      const responseWrapper = {
        write: (data) => {
          try {
            controller.enqueue(encoder.encode(data))
          } catch (e) {
            // Stream closed
          }
        },
        on: (event, handler) => {
          if (event === 'close') {
            // Handle cleanup - this is called when the stream ends
            req.signal?.addEventListener('abort', handler)
          }
        },
      }

      // Register connection
      addConnection(userId, responseWrapper)

      // Clean up on abort
      req.signal?.addEventListener('abort', () => {
        clearInterval(keepAlive)
        removeConnection(userId, responseWrapper)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

