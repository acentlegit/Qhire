import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { prisma } from '../../../../lib/db.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/profile
 * Get current user's profile
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        theme: true,
        timezone: true,
        createdAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, 'Failed to fetch profile'),
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/profile
 * Update current user's profile
 */
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body'),
        { status: 400 }
      )
    }

    const { name, phone, avatarUrl, theme, timezone } = body

    console.log('Profile update request:', {
      userId: session.user.id,
      body: { name, phone, avatarUrl, theme, timezone }
    })

    // Validate theme
    if (theme && !['light', 'dark', 'system'].includes(theme)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid theme value'),
        { status: 400 }
      )
    }

    // Validate timezone (basic check - should be a valid IANA timezone)
    if (timezone && typeof timezone !== 'string') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid timezone value'),
        { status: 400 }
      )
    }

    // Build update data
    const updateData = {}
    if (name !== undefined) updateData.name = name || null
    if (phone !== undefined) updateData.phone = phone || null
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null
    if (theme !== undefined) updateData.theme = theme || null
    if (timezone !== undefined) updateData.timezone = timezone || null

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'No fields to update'),
        { status: 400 }
      )
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        theme: true,
        timezone: true
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating user profile:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'),
        { status: 404 }
      )
    }

    // Handle Prisma validation errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.DUPLICATE, 'A record with this value already exists'),
        { status: 400 }
      )
    }

    // Return more detailed error message
    const errorMessage = error.message || 'Failed to update profile'
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, errorMessage),
      { status: 500 }
    )
  }
}

