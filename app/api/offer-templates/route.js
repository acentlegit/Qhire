import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../lib/errors.js'
import { authOptions } from '../../../lib/auth.js'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  variables: z.any().optional(),
  isDefault: z.boolean().default(false)
})

// GET - List all templates
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Sign in required'),
        { status: 401 }
      )
    }

    const templates = await prisma.offerTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to fetch templates'
      ),
      { status: 500 }
    )
  }
}

// POST - Create new template
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Sign in required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    const validation = templateSchema.safeParse(data)
    
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

    // If setting as default, unset other defaults
    if (validation.data.isDefault) {
      await prisma.offerTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const template = await prisma.offerTemplate.create({
      data: {
        ...validation.data,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to create template'
      ),
      { status: 500 }
    )
  }
}

