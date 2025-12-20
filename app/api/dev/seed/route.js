import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'

export async function POST() {
  try {
    const user = await prisma.user.upsert({
      where: { email: 'admin@qhire.local' },
      update: {},
      create: { 
        email: 'admin@qhire.local', 
        name: 'Admin', 
        role: 'ADMIN' 
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

