/**
 * Redis Queue Setup
 * 
 * This file sets up Redis connection and BullMQ queues for background job processing.
 * 
 * Installation:
 * npm install ioredis bullmq
 * 
 * Environment Variables:
 * REDIS_URL=redis://localhost:6379
 * or
 * REDIS_HOST=localhost
 * REDIS_PORT=6379
 * REDIS_PASSWORD=your_password
 */

let redis = null
let queues = {}

/**
 * Initialize Redis connection
 */
export function initRedis() {
  if (redis) {
    return redis
  }

  try {
    const Redis = require('ioredis')
    
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    }

    // Use REDIS_URL if provided (for cloud services like Upstash, Redis Cloud)
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, redisConfig)
    } else {
      redis = new Redis(redisConfig)
    }

    redis.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    redis.on('connect', () => {
      console.log('✅ Redis connected')
    })

    return redis
  } catch (error) {
    console.error('Failed to initialize Redis:', error)
    console.warn('⚠️  Redis not available. Queue features will be disabled.')
    return null
  }
}

/**
 * Get Redis connection
 */
export function getRedis() {
  if (!redis) {
    return initRedis()
  }
  return redis
}

/**
 * Initialize BullMQ queues
 */
export function initQueues() {
  if (Object.keys(queues).length > 0) {
    return queues
  }

  try {
    const { Queue } = require('bullmq')
    const redisConnection = getRedis()

    if (!redisConnection) {
      console.warn('⚠️  Redis not available. Queues will not be initialized.')
      return {}
    }

    // Resume parsing queue
    queues.resumeParse = new Queue('resume-parse', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    // Email sending queue
    queues.email = new Queue('email', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    })

    // Job matching queue
    queues.matching = new Queue('job-matching', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
      },
    })

    // Bulk processing queue
    queues.bulkProcess = new Queue('bulk-process', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    })

    console.log('✅ BullMQ queues initialized')
    return queues
  } catch (error) {
    console.error('Failed to initialize queues:', error)
    return {}
  }
}

/**
 * Get a specific queue
 */
export function getQueue(name) {
  if (Object.keys(queues).length === 0) {
    initQueues()
  }
  return queues[name] || null
}

/**
 * Add job to queue
 */
export async function addJob(queueName, jobData, options = {}) {
  const queue = getQueue(queueName)
  if (!queue) {
    throw new Error(`Queue ${queueName} not available. Redis may not be configured.`)
  }
  return await queue.add(jobData.name || 'job', jobData, options)
}

/**
 * Close all connections
 */
export async function closeConnections() {
  if (redis) {
    await redis.quit()
    redis = null
  }
  
  for (const queue of Object.values(queues)) {
    await queue.close()
  }
  
  queues = {}
}

// Initialize on import (lazy)
if (typeof window === 'undefined') {
  // Server-side only
  initRedis()
}

