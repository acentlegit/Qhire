import { NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'

export const dynamic = 'force-dynamic'

// Local upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

/**
 * POST /api/upload/local
 * Handle local file uploads via FormData (for interview resume upload)
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const purpose = formData.get('purpose') || 'general'

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const originalName = file.name
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${purpose}/${sanitizedName}_${timestamp}${ext}`
    const fileKey = fileName

    // Create directory structure
    const filePath = path.join(UPLOAD_DIR, fileKey)
    const dirPath = path.dirname(filePath)

    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true })
    }

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    console.log(`✅ File uploaded locally: ${filePath}`)

    // Return URL that can be used to access the file via API
    // Use the full path for server-side access
    const fileUrl = filePath

    return NextResponse.json({ 
      success: true, 
      path: filePath,
      url: fileUrl,
      key: fileKey,
      // Also provide API URL for client-side access if needed
      apiUrl: `/api/upload/local?key=${encodeURIComponent(fileKey)}`
    })
  } catch (error) {
    console.error('Local upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/upload/local
 * Handle local file uploads when S3 is not configured
 */
export async function PUT(req) {
  try {
    const { searchParams } = new URL(req.url)
    const fileKey = searchParams.get('key')

    if (!fileKey) {
      return NextResponse.json(
        { error: 'Missing file key' },
        { status: 400 }
      )
    }

    // Get file data from request body
    const buffer = Buffer.from(await req.arrayBuffer())

    // Create directory structure
    const filePath = path.join(UPLOAD_DIR, fileKey)
    const dirPath = path.dirname(filePath)

    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true })
    }

    // Write file
    await writeFile(filePath, buffer)

    console.log(`✅ File uploaded locally: ${filePath}`)

    return NextResponse.json({ 
      success: true, 
      path: filePath,
      url: `/api/upload/local?key=${encodeURIComponent(fileKey)}&download=true`
    })
  } catch (error) {
    console.error('Local upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/upload/local
 * Download/serve locally uploaded files
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const fileKey = searchParams.get('key')
    const download = searchParams.get('download')

    if (!fileKey) {
      return NextResponse.json(
        { error: 'Missing file key' },
        { status: 400 }
      )
    }

    const filePath = path.join(UPLOAD_DIR, fileKey)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    const fileBuffer = await readFile(filePath)
    const filename = path.basename(fileKey)

    // Determine content type
    const ext = path.extname(filename).toLowerCase()
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    const headers = {
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
    }

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error('Local download error:', error)
    return NextResponse.json(
      { error: error.message || 'Download failed' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/upload/local
 * Delete locally uploaded files
 */
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const fileKey = searchParams.get('key')

    if (!fileKey) {
      return NextResponse.json(
        { error: 'Missing file key' },
        { status: 400 }
      )
    }

    const filePath = path.join(UPLOAD_DIR, fileKey)

    if (existsSync(filePath)) {
      await unlink(filePath)
      console.log(`🗑️ File deleted: ${filePath}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Local delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Delete failed' },
      { status: 500 }
    )
  }
}
