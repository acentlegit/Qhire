import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Health check endpoint for monitoring and container orchestration
 */
export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'disconnected'
    }, { status: 503 })
  }
}

