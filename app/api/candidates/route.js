import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { candidateSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/activity.js'

export const dynamic = 'force-dynamic'

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Cap at 100
    const skip = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const skills = searchParams.get('skills') || ''
    const status = searchParams.get('status') || ''
    const experience = searchParams.get('experience') || ''

    // Build where clause for filtering
    const where = {}
    
    // Search (name or email) - OR condition
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    // Skills filter - add to AND conditions (not OR)
    if (skills) {
      where.skills = { contains: skills, mode: 'insensitive' }
    }
    
    // Status filter
    if (status) {
      where.status = status
    }
    
    // Experience filter
    if (experience) {
      if (experience === '0-2') {
        where.yearsExperience = { gte: 0, lte: 2 }
      } else if (experience === '3-5') {
        where.yearsExperience = { gte: 3, lte: 5 }
      } else if (experience === '6-10') {
        where.yearsExperience = { gte: 6, lte: 10 }
      } else if (experience === '10+') {
        where.yearsExperience = { gte: 10 }
      }
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({ 
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.candidate.count({ where })
    ])

    return NextResponse.json({
      data: candidates,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching candidates:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch candidates'),
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    
    // Validate with Zod
    const validation = candidateSchema.safeParse(data)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { fields: validation.error.errors }
        ),
        { status: 400 }
      )
    }

    const candidate = await prisma.candidate.create({ 
      data: validation.data,
      include: {
        Applications: {
          select: {
            id: true,
            stage: true
          }
        }
      }
    })
    
    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'CREATED',
      entityType: 'CANDIDATE',
      entityId: candidate.id,
      metadata: { name: candidate.name, email: candidate.email }
    })
    
    return NextResponse.json(candidate, { status: 201 })
  } catch (error) {
    console.error('Error creating candidate:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.DUPLICATE,
          'A candidate with this email already exists',
          { field: 'email' }
        ),
        { status: 400 }
      )
    }
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create candidate'
      ),
      { status: 500 }
    )
  }
}

