import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth.js'
import { createErrorResponse, ERROR_CODES } from '../../../../lib/errors.js'
import { prisma } from '../../../../lib/db.js'

export const dynamic = 'force-dynamic'

// Apify configuration
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_LINKEDIN_ACTOR = 'apify/linkedin-profile-scraper'

/**
 * LinkedIn Profile Scraping API
 * POST /api/scraping/linkedin
 * 
 * Supports:
 * - Apify LinkedIn scraper (production)
 * - Mock data (development)
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      )
    }

    const { linkedinUrl, createCandidate = false } = await req.json()

    if (!linkedinUrl) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'linkedinUrl is required'),
        { status: 400 }
      )
    }

    // Validate LinkedIn URL format
    const linkedinUrlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/
    if (!linkedinUrlPattern.test(linkedinUrl)) {
      return NextResponse.json(
        createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid LinkedIn URL format. Use format: https://www.linkedin.com/in/username'),
        { status: 400 }
      )
    }

    let profileData

    // Use Apify if configured, otherwise use mock data
    if (APIFY_API_TOKEN) {
      profileData = await scrapeWithApify(linkedinUrl)
    } else {
      // Use mock data for development
      profileData = generateMockProfile(linkedinUrl)
      profileData._isMock = true
    }

    // Optionally create candidate from scraped data
    let candidate = null
    if (createCandidate && profileData.name) {
      candidate = await createCandidateFromProfile(profileData, session.user.id)
    }

    return NextResponse.json({
      success: true,
      profileData,
      candidate: candidate ? { id: candidate.id, name: candidate.name } : null,
      source: APIFY_API_TOKEN ? 'apify' : 'mock',
      message: APIFY_API_TOKEN 
        ? 'Profile scraped successfully from LinkedIn' 
        : 'Using mock data. Set APIFY_API_TOKEN for real scraping.',
    })

  } catch (error) {
    console.error('LinkedIn scraping error:', error)
    return NextResponse.json(
      createErrorResponse(
        ERROR_CODES.SERVER_ERROR,
        error.message || 'Failed to scrape LinkedIn profile'
      ),
      { status: 500 }
    )
  }
}

/**
 * Scrape LinkedIn profile using Apify
 */
async function scrapeWithApify(linkedinUrl) {
  const runInput = {
    startUrls: [{ url: linkedinUrl }],
    proxy: { useApifyProxy: true },
  }

  // Start the actor run
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_LINKEDIN_ACTOR}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runInput),
    }
  )

  if (!runResponse.ok) {
    throw new Error(`Apify run failed: ${runResponse.statusText}`)
  }

  const runData = await runResponse.json()
  const runId = runData.data.id

  // Wait for the run to finish (poll every 2 seconds, max 60 seconds)
  let status = 'RUNNING'
  let attempts = 0
  const maxAttempts = 30

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    )
    const statusData = await statusResponse.json()
    status = statusData.data.status
    attempts++
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run did not complete: ${status}`)
  }

  // Get the results
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
  )
  const items = await datasetResponse.json()

  if (!items || items.length === 0) {
    throw new Error('No profile data returned from Apify')
  }

  const profile = items[0]

  // Transform Apify response to our format
  return {
    name: profile.fullName || profile.firstName + ' ' + profile.lastName,
    email: profile.email || null,
    phone: profile.phone || null,
    currentCompany: profile.currentCompany?.name || profile.company || null,
    currentRole: profile.headline || profile.title || null,
    location: profile.location || null,
    summary: profile.summary || profile.about || null,
    experience: (profile.experience || []).map(exp => ({
      company: exp.companyName || exp.company,
      role: exp.title || exp.role,
      duration: exp.dateRange || `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
      description: exp.description || '',
    })),
    education: (profile.education || []).map(edu => ({
      institution: edu.schoolName || edu.school,
      degree: edu.degreeName || edu.degree,
      year: edu.dateRange || edu.endDate,
    })),
    skills: profile.skills || [],
    linkedinUrl: linkedinUrl,
    profileImage: profile.profilePicture || profile.profileImage || null,
    connections: profile.connectionsCount || null,
    scrapedAt: new Date().toISOString(),
    confidence: 0.9,
  }
}

/**
 * Generate mock profile data for development
 */
function generateMockProfile(linkedinUrl) {
  // Extract username from URL
  const username = linkedinUrl.split('/in/')[1]?.replace('/', '') || 'john-doe'
  const nameParts = username.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1))
  const name = nameParts.slice(0, 2).join(' ')

  return {
    name: name,
    email: `${username.replace('-', '.')}@example.com`,
    phone: '+1 (555) 123-4567',
    currentCompany: 'Tech Company Inc.',
    currentRole: 'Senior Software Engineer',
    location: 'San Francisco Bay Area',
    summary: `Experienced software engineer with 5+ years of experience in full-stack development. Passionate about building scalable applications and working with modern technologies.`,
    experience: [
      {
        company: 'Tech Company Inc.',
        role: 'Senior Software Engineer',
        duration: 'Jan 2022 - Present',
        description: 'Leading development of microservices architecture and mentoring junior developers.',
      },
      {
        company: 'StartupXYZ',
        role: 'Software Engineer',
        duration: 'Jun 2019 - Dec 2021',
        description: 'Built full-stack applications using React, Node.js, and PostgreSQL.',
      },
      {
        company: 'Big Corp',
        role: 'Junior Developer',
        duration: 'Jan 2018 - May 2019',
        description: 'Developed internal tools and maintained legacy systems.',
      },
    ],
    education: [
      {
        institution: 'University of California',
        degree: 'B.S. Computer Science',
        year: '2017',
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'PostgreSQL', 'Docker', 'Kubernetes'],
    linkedinUrl: linkedinUrl,
    profileImage: null,
    connections: 500,
    scrapedAt: new Date().toISOString(),
    confidence: 1.0,
  }
}

/**
 * Create a candidate from scraped profile data
 */
async function createCandidateFromProfile(profileData, userId) {
  // Check if candidate already exists with same LinkedIn URL
  const existing = await prisma.candidate.findFirst({
    where: {
      OR: [
        { linkedinUrl: profileData.linkedinUrl },
        { email: profileData.email },
      ],
    },
  })

  if (existing) {
    // Update existing candidate
    return await prisma.candidate.update({
      where: { id: existing.id },
      data: {
        name: profileData.name || existing.name,
        phone: profileData.phone || existing.phone,
        skills: profileData.skills?.join(', ') || existing.skills,
        experience: profileData.experience || existing.experience,
        education: profileData.education || existing.education,
        currentCompany: profileData.currentCompany || existing.currentCompany,
        currentRole: profileData.currentRole || existing.currentRole,
        location: profileData.location || existing.location,
        linkedinUrl: profileData.linkedinUrl,
        source: 'LINKEDIN',
        updatedAt: new Date(),
      },
    })
  }

  // Create new candidate
  return await prisma.candidate.create({
    data: {
      name: profileData.name || 'Unknown',
      email: profileData.email || `linkedin-${Date.now()}@placeholder.com`,
      phone: profileData.phone,
      skills: profileData.skills?.join(', '),
      experience: profileData.experience,
      education: profileData.education,
      currentCompany: profileData.currentCompany,
      currentRole: profileData.currentRole,
      location: profileData.location,
      linkedinUrl: profileData.linkedinUrl,
      source: 'LINKEDIN',
      status: 'NEW',
      createdById: userId,
    },
  })
}

/**
 * GET /api/scraping/linkedin
 * Get scraping configuration status
 */
export async function GET(req) {
  const isConfigured = !!APIFY_API_TOKEN

  return NextResponse.json({
    service: 'LinkedIn Profile Scraper',
    status: isConfigured ? 'configured' : 'not_configured',
    provider: isConfigured ? 'Apify' : 'Mock Data',
    features: [
      'Scrape LinkedIn profiles by URL',
      'Extract name, email, phone, experience, education, skills',
      'Auto-create candidates from scraped data',
      'Bulk scraping support',
    ],
    setup: isConfigured ? null : {
      instructions: 'Add APIFY_API_TOKEN to .env for production scraping',
      steps: [
        '1. Sign up at https://apify.com',
        '2. Get your API token from Settings > Integrations',
        '3. Add to .env: APIFY_API_TOKEN=your_token_here',
        '4. Restart server',
      ],
      pricing: 'Apify has a free tier with limited credits',
    },
  })
}

