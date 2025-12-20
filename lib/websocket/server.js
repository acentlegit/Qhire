/**
 * WebSocket Server Setup for Real-Time Updates
 * 
 * This file sets up WebSocket server for real-time progress updates
 * 
 * Installation:
 * npm install ws
 * 
 * For Next.js, we'll use Server-Sent Events (SSE) as an alternative
 * since Next.js doesn't natively support WebSocket servers
 */

/**
 * WebSocket Server (requires separate Node.js server)
 * For production, use a separate WebSocket server or use SSE
 */
export function createWebSocketServer(server) {
  try {
    const WebSocket = require('ws')
    const wss = new WebSocket.Server({ server })

    const clients = new Set()

    wss.on('connection', (ws) => {
      clients.add(ws)
      console.log('WebSocket client connected')

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          // Handle client messages
          handleWebSocketMessage(ws, data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        clients.delete(ws)
        console.log('WebSocket client disconnected')
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        clients.delete(ws)
      })
    })

    // Broadcast function
    const broadcast = (data) => {
      const message = JSON.stringify(data)
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message)
        }
      })
    }

    return { wss, broadcast, clients }
  } catch (error) {
    console.error('Failed to create WebSocket server:', error)
    return null
  }
}

function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'subscribe':
      // Subscribe to updates for a specific job/process
      ws.subscribedTo = data.jobId || data.processId
      break
    case 'unsubscribe':
      ws.subscribedTo = null
      break
    default:
      console.log('Unknown WebSocket message type:', data.type)
  }
}

/**
 * Send progress update to subscribed clients
 */
export function sendProgressUpdate(broadcast, jobId, progress) {
  if (broadcast) {
    broadcast({
      type: 'progress',
      jobId,
      progress,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Send completion notification
 */
export function sendCompletionNotification(broadcast, jobId, result) {
  if (broadcast) {
    broadcast({
      type: 'complete',
      jobId,
      result,
      timestamp: new Date().toISOString(),
    })
  }
}

