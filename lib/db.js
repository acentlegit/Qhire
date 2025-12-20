import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

// Enhanced Prisma Client with connection pooling and retry configuration
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool configuration
    // These are handled by Neon's pooled connection string, but we set them for clarity
  })

// Connection health check and auto-reconnect
if (typeof process !== 'undefined') {
  // Graceful shutdown
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })

  // Keep connection alive with periodic ping
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`
      } catch (error) {
        console.error('Connection health check failed:', error)
        // Connection errors will be retried automatically by Prisma
      }
    }, 30000) // Every 30 seconds
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Helper to ensure connection is active
export async function ensureConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection check failed:', error)
    // Try to reconnect
    try {
      await prisma.$connect()
      return true
    } catch (reconnectError) {
      console.error('Reconnection failed:', reconnectError)
      return false
    }
  }
}

