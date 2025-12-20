import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/db.js'
import { updateNoteSchema } from '../../../../lib/validations.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { authOptions } from '../../../../lib/auth.js'

export const dynamic = 'force-dynamic'

export async function GET(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const note = await prisma.note.findUnique({
      where: { id: params.id },
      include: {
        candidate: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!note) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Note not found'),
        { status: 404 }
      )
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error fetching note:', error)
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to fetch note'),
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const data = await req.json()
    const validation = updateNoteSchema.safeParse(data)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', validation.error.errors),
        { status: 400 }
      )
    }

    const note = await prisma.note.update({
      where: { id: params.id },
      data: validation.data,
      include: {
        candidate: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Note not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to update note'),
      { status: 500 }
    )
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    await prisma.note.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    if (error.code === 'P2025') {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.NOT_FOUND, 'Note not found'),
        { status: 404 }
      )
    }
    return NextResponse.json(
      createErrorResponse(ERROR_CODES.SERVER_ERROR, error.message || 'Failed to delete note'),
      { status: 500 }
    )
  }
}
