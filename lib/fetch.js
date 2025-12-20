// Safe fetch utility that handles JSON/HTML errors gracefully
export async function fetchJSON(url, options = {}) {
  // Use relative URLs to avoid port mismatches
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`
  
  const res = await fetch(fullUrl, {
    headers: { 
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options,
  })

  // Check content-type before parsing
  const contentType = res.headers.get('content-type') || ''
  
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    const preview = text.slice(0, 200)
    
    // If it's HTML, it's likely an error page or redirect
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(
        `Expected JSON but got HTML. Status: ${res.status}. ` +
        `This usually means: wrong URL, auth redirect, or server error. ` +
        `URL: ${fullUrl}`
      )
    }
    
    throw new Error(
      `Expected JSON but got ${contentType}. Status: ${res.status}. ` +
      `Preview: ${preview}`
    )
  }

  const data = await res.json()
  
  if (!res.ok) {
    // Handle standardized error format
    const error = data?.error || { 
      code: 'SERVER_ERROR', 
      message: data?.message || `HTTP ${res.status}` 
    }
    throw new Error(`${error.code}: ${error.message}`)
  }
  
  return data
}

