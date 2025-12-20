#!/usr/bin/env node

/**
 * Session Cleanup Script
 * Cleans up expired and inactive sessions
 * 
 * Usage:
 *   node scripts/cleanup-sessions.js
 * 
 * Or set up as a cron job:
 *   0 2 * * * cd /path/to/project && node scripts/cleanup-sessions.js
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function cleanupSessions() {
  try {
    console.log('🧹 Starting session cleanup...')
    
    // Clean up expired sessions
    const now = new Date()
    const expiredCleaned = await prisma.session.updateMany({
      where: {
        expiresAt: { lt: now },
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    // Clean up sessions inactive for 30+ days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const inactiveCleaned = await prisma.session.updateMany({
      where: {
        isActive: true,
        lastActivityAt: {
          lt: thirtyDaysAgo
        }
      },
      data: {
        isActive: false
      }
    })

    console.log('✅ Session cleanup completed:')
    console.log(`   - Expired sessions cleaned: ${expiredCleaned.count}`)
    console.log(`   - Inactive sessions cleaned: ${inactiveCleaned.count}`)
    console.log(`   - Total cleaned: ${expiredCleaned.count + inactiveCleaned.count}`)
  } catch (error) {
    console.error('❌ Error during session cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run cleanup
cleanupSessions()

