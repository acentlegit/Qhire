import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Server-Sent Events (SSE) endpoint for real-time updates
 * GET /api/events/stream?jobId=xxx
 * 
 * Alternative to WebSocket for Next.js (easier to implement)
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`))

      // Set up interval to send progress updates
      const interval = setInterval(async () => {
        try {
          // Fetch current progress from database
          const { prisma } = await import('../../../../lib/db.js')
          const job = await prisma.bulkParseJob.findUnique({
            where: { id: jobId },
            select: {
              id: true,
              status: true,
              progress: true,
              processedFiles: true,
              totalFiles: true,
              failedFiles: true,
            },
          })

          if (job) {
            const data = {
              type: 'progress',
              jobId: job.id,
              status: job.status,
              progress: job.progress || 0,
              processedFiles: job.processedFiles,
              totalFiles: job.totalFiles,
              failedFiles: job.failedFiles,
              timestamp: new Date().toISOString(),
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

            // Close stream if job is completed
            if (job.status === 'COMPLETED' || job.status === 'FAILED') {
              clearInterval(interval)
              controller.close()
            }
          }
        } catch (error) {
          console.error('SSE error:', error)
          clearInterval(interval)
          controller.close()
        }
      }, 2000) // Update every 2 seconds

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
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

