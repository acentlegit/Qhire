/**
 * Simple API test script
 * Run with: node scripts/test-api.js
 * 
 * Make sure the dev server is running first: npm run dev
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001'

// Test credentials (you'll need to sign up first or use existing)
const TEST_EMAIL = 'admin@qhire.local'
const TEST_PASSWORD = 'password'

let sessionToken = null

async function fetchJSON(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionToken && { Cookie: sessionToken }),
    ...options.headers
  }

  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  
  if (!text) return null
  
  try {
    return JSON.parse(text)
  } catch {
    console.error('Failed to parse JSON:', text.slice(0, 200))
    return null
  }
}

async function testSignIn() {
  console.log('\n🔐 Testing Sign In...')
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  })
  
  const cookies = res.headers.get('set-cookie')
  if (cookies) {
    sessionToken = cookies.split(';')[0]
    console.log('✅ Signed in successfully')
    return true
  }
  console.log('❌ Sign in failed')
  return false
}

async function testOffers() {
  console.log('\n📄 Testing Offers API...')
  
  // Get applications first (need one for offer)
  const appsRes = await fetchJSON(`${BASE_URL}/api/applications?limit=1`)
  if (!appsRes || !appsRes.data || appsRes.data.length === 0) {
    console.log('⚠️  No applications found, skipping offer test')
    return
  }
  
  const applicationId = appsRes.data[0].id
  
  // Create offer
  console.log('  Creating offer...')
  const offer = await fetchJSON(`${BASE_URL}/api/offers`, {
    method: 'POST',
    body: JSON.stringify({
      applicationId,
      salary: 120000,
      currency: 'USD',
      status: 'DRAFT',
      benefits: { healthInsurance: true, remoteWork: true }
    })
  })
  
  if (offer && offer.id) {
    console.log('  ✅ Offer created:', offer.id)
    
    // Get offer
    const getOffer = await fetchJSON(`${BASE_URL}/api/offers/${offer.id}`)
    console.log('  ✅ Offer retrieved:', getOffer ? 'success' : 'failed')
    
    // Update offer
    const updated = await fetchJSON(`${BASE_URL}/api/offers/${offer.id}`, {
      method: 'PUT',
      body: JSON.stringify({ salary: 130000 })
    })
    console.log('  ✅ Offer updated:', updated ? 'success' : 'failed')
  } else {
    console.log('  ❌ Failed to create offer')
  }
}

async function testEvents() {
  console.log('\n📅 Testing Events API...')
  
  // Get applications first
  const appsRes = await fetchJSON(`${BASE_URL}/api/applications?limit=1`)
  if (!appsRes || !appsRes.data || appsRes.data.length === 0) {
    console.log('⚠️  No applications found, skipping event test')
    return
  }
  
  const applicationId = appsRes.data[0].id
  const start = new Date()
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11, 0, 0, 0)
  
  // Create event
  console.log('  Creating event...')
  const event = await fetchJSON(`${BASE_URL}/api/events`, {
    method: 'POST',
    body: JSON.stringify({
      applicationId,
      type: 'INTERVIEW',
      title: 'Technical Interview',
      description: 'First round technical interview',
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: 'UTC',
      location: 'Virtual - Google Meet'
    })
  })
  
  if (event && event.id) {
    console.log('  ✅ Event created:', event.id)
    
    // Get events
    const events = await fetchJSON(`${BASE_URL}/api/events?applicationId=${applicationId}`)
    console.log('  ✅ Events retrieved:', events?.data?.length || 0, 'events')
  } else {
    console.log('  ❌ Failed to create event')
  }
}

async function testNotes() {
  console.log('\n📝 Testing Notes API...')
  
  // Get candidates first
  const candidatesRes = await fetchJSON(`${BASE_URL}/api/candidates?limit=1`)
  if (!candidatesRes || !candidatesRes.data || candidatesRes.data.length === 0) {
    console.log('⚠️  No candidates found, skipping note test')
    return
  }
  
  const candidateId = candidatesRes.data[0].id
  
  // Create note
  console.log('  Creating note...')
  const note = await fetchJSON(`${BASE_URL}/api/notes`, {
    method: 'POST',
    body: JSON.stringify({
      candidateId,
      content: 'Great candidate, strong technical skills. Follow up needed.',
      isPrivate: false,
      tags: ['positive', 'technical']
    })
  })
  
  if (note && note.id) {
    console.log('  ✅ Note created:', note.id)
    
    // Get notes
    const notes = await fetchJSON(`${BASE_URL}/api/notes?candidateId=${candidateId}`)
    console.log('  ✅ Notes retrieved:', notes?.data?.length || 0, 'notes')
  } else {
    console.log('  ❌ Failed to create note')
  }
}

async function testActivity() {
  console.log('\n📊 Testing Activity API...')
  
  const activity = await fetchJSON(`${BASE_URL}/api/activity?limit=5`)
  if (activity && activity.data) {
    console.log('  ✅ Activity log retrieved:', activity.data.length, 'entries')
    if (activity.data.length > 0) {
      console.log('  Latest activity:', activity.data[0].action, activity.data[0].entityType)
    }
  } else {
    console.log('  ❌ Failed to get activity log')
  }
}

async function testAttachments() {
  console.log('\n📎 Testing Attachments API...')
  
  // Get candidates first
  const candidatesRes = await fetchJSON(`${BASE_URL}/api/candidates?limit=1`)
  if (!candidatesRes || !candidatesRes.data || candidatesRes.data.length === 0) {
    console.log('⚠️  No candidates found, skipping attachment test')
    return
  }
  
  const candidateId = candidatesRes.data[0].id
  
  // Create attachment record
  console.log('  Creating attachment record...')
  const attachment = await fetchJSON(`${BASE_URL}/api/attachments`, {
    method: 'POST',
    body: JSON.stringify({
      entityType: 'CANDIDATE',
      entityId: candidateId,
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      size: 123456,
      url: 'https://s3.example.com/resume.pdf'
    })
  })
  
  if (attachment && attachment.id) {
    console.log('  ✅ Attachment created:', attachment.id)
    
    // Get attachments
    const attachments = await fetchJSON(`${BASE_URL}/api/attachments?entityType=CANDIDATE&entityId=${candidateId}`)
    console.log('  ✅ Attachments retrieved:', attachments?.data?.length || 0, 'attachments')
  } else {
    console.log('  ❌ Failed to create attachment')
  }
}

async function runTests() {
  console.log('🧪 Starting API Tests...')
  console.log(`📍 Base URL: ${BASE_URL}`)
  
  // Sign in first
  const signedIn = await testSignIn()
  if (!signedIn) {
    console.log('\n❌ Cannot proceed without authentication')
    console.log('💡 Make sure you have a user account or run: npm run db:seed')
    return
  }
  
  // Run tests
  await testOffers()
  await testEvents()
  await testNotes()
  await testActivity()
  await testAttachments()
  
  console.log('\n✅ All tests completed!')
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error)
}

export { runTests }

