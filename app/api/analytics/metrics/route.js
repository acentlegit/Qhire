import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'
import { withRetry } from '../../../../lib/db-retry.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/metrics?days=30
 * Get analytics metrics
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    const jobId = searchParams.get('jobId')
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // Previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - days)
    
    // Build base where clause
    const baseWhere = {
      createdAt: { gte: startDate },
      ...(jobId && { jobId })
    }
    
    const previousWhere = {
      createdAt: { gte: previousStartDate, lt: startDate },
      ...(jobId && { jobId })
    }

    // Total applications
    const totalApplications = await withRetry(async () => {
      return await prisma.application.count({
        where: baseWhere,
      })
    })

    // Previous period applications
    const previousApplications = await withRetry(async () => {
      return await prisma.application.count({
        where: previousWhere,
      })
    })

    // Total hires
    const totalHires = await withRetry(async () => {
      return await prisma.application.count({
        where: {
          ...baseWhere,
          stage: 'HIRED',
        },
      })
    })

    // Previous period hires
    const previousHires = await withRetry(async () => {
      return await prisma.application.count({
        where: {
          ...previousWhere,
          stage: 'HIRED',
        },
      })
    })

    // Funnel data
    const funnelData = await withRetry(async () => {
      const stages = [
        { key: 'APPLIED', name: 'Applied' },
        { key: 'SCREENING', name: 'Screen' },
        { key: 'INTERVIEW', name: 'Interview' },
        { key: 'OFFER', name: 'Offer' },
        { key: 'HIRED', name: 'Hired' },
        { key: 'REJECTED', name: 'Rejected' }
      ]
      const data = []
      
      for (const stage of stages) {
        const count = await prisma.application.count({
          where: {
            ...baseWhere,
            stage: stage.key,
          },
        })
        data.push({ stage: stage.name, count })
      }
      
      return data
    })

    // Source data
    const sourceData = await withRetry(async () => {
      const sources = await prisma.application.groupBy({
        by: ['source'],
        where: baseWhere,
        _count: true,
      })
      
      return sources.map(s => ({
        name: s.source || 'Unknown',
        value: s._count,
      }))
    })

    // Time to hire (average days from application to hire)
    const avgTimeToHire = await withRetry(async () => {
      const hiredApps = await prisma.application.findMany({
        where: {
          ...baseWhere,
          stage: 'HIRED',
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      })

      if (hiredApps.length === 0) return 0

      const totalDays = hiredApps.reduce((sum, app) => {
        const days = Math.floor((new Date(app.updatedAt || app.createdAt) - new Date(app.createdAt)) / (1000 * 60 * 60 * 24))
        return sum + days
      }, 0)

      return Math.round(totalDays / hiredApps.length)
    })

    // Time to hire trend (monthly)
    const timeToHireTrend = await withRetry(async () => {
      const months = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date()
        monthStart.setMonth(monthStart.getMonth() - i)
        monthStart.setDate(1)
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)

        const monthWhere = {
          createdAt: { gte: monthStart, lt: monthEnd },
          stage: 'HIRED',
          ...(jobId && { jobId })
        }

        const hiredInMonth = await prisma.application.findMany({
          where: monthWhere,
          select: {
            createdAt: true,
            updatedAt: true,
          },
        })

        const avgDays = hiredInMonth.length > 0
          ? Math.round(
              hiredInMonth.reduce((sum, app) => {
                const days = Math.floor((new Date(app.updatedAt || app.createdAt) - new Date(app.createdAt)) / (1000 * 60 * 60 * 24))
                return sum + days
              }, 0) / hiredInMonth.length
            )
          : 0

        months.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          days: avgDays,
        })
      }

      return months
    })

    // Conversion rate
    const conversionRate = totalApplications > 0
      ? Math.round((totalHires / totalApplications) * 100)
      : 0

    // Previous period conversion rate
    const previousConversionRate = previousApplications > 0
      ? Math.round((previousHires / previousApplications) * 100)
      : 0

    // Generate AI Insights
    const aiInsights = []
    
    // Insight 1: Time to hire improvement
    if (avgTimeToHire > 0 && totalHires > 3) {
      aiInsights.push({
        type: 'insight',
        message: `Average time to hire is ${avgTimeToHire} days. Consider AI screening to reduce this by up to 25%`
      })
    }

    // Insight 2: Bottleneck detection (using funnel data)
    const funnelStages = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired']
    let maxDropStage = null
    let maxDropRate = 0
    
    for (let i = 1; i < funnelStages.length; i++) {
      const prevData = funnelData.find(d => d.stage === funnelStages[i - 1])
      const currData = funnelData.find(d => d.stage === funnelStages[i])
      const prevCount = prevData?.count || 0
      const currCount = currData?.count || 0
      
      if (prevCount > 0) {
        const dropRate = ((prevCount - currCount) / prevCount) * 100
        if (dropRate > maxDropRate) {
          maxDropRate = dropRate
          maxDropStage = funnelStages[i]
        }
      }
    }
    
    if (maxDropRate > 40 && maxDropStage) {
      aiInsights.push({
        type: 'bottleneck',
        message: `Most drop-offs happen at ${maxDropStage} stage (${Math.round(maxDropRate)}% drop)`
      })
    }

    return NextResponse.json({
      success: true,
      totalApplications,
      previousApplications,
      totalHires,
      previousHires,
      avgTimeToHire,
      conversionRate,
      previousConversionRate,
      funnelData,
      sourceData,
      timeToHireTrend,
      aiInsights: aiInsights.slice(0, 3), // Max 3 insights
    }, { status: 200 })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch analytics'
      ),
      { status: 500 }
    )
  }
}

