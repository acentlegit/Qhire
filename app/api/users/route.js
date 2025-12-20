import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { userSchema } from '../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import bcrypt from 'bcryptjs'

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

    // Only admins can view users list
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.FORBIDDEN, 'Only admins can view users'),
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''

    // Build where clause
    const where = {}
    const andConditions = []
    
    // Search (name or email)
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    }
    
    // Role filter
    if (role) {
      where.role = role
    }
    
    // Status filter (active = not locked, disabled = locked)
    if (status === 'active') {
      andConditions.push({
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lt: new Date() } }
        ]
      })
    } else if (status === 'disabled') {
      andConditions.push({
        lockedUntil: { gte: new Date() }
      })
    }
    
    // Combine AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          lockedUntil: true,
          mfaEnabled: true,
          Devices: {
            select: {
              id: true
            },
            take: 1
          }
        }
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch users'),
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    // Validate with Zod
    const validation = userSchema.safeParse(data)
    if (!validation.success) {
      console.error('User validation failed:', validation.error.errors)
      console.error('Validation data received:', data)
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          { fields: validation.error.errors }
        ),
        { status: 400 }
      )
    }

    const { name, email, password, role = 'RECRUITER' } = validation.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.DUPLICATE,
          'User with this email already exists',
          { field: 'email' }
        ),
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse(
          ERROR_CODES.DUPLICATE,
          'A user with this email already exists',
          { field: 'email' }
        ),
        { status: 400 }
      )
    }
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create user'
      ),
      { status: 500 }
    )
  }
}

