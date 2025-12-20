'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { fetchJSON } from '../../lib/fetch.js'

/**
 * LinkedIn Profile Scraper Component
 * Allows recruiters to scrape LinkedIn profiles and auto-fill candidate forms
 */
export default function LinkedInScraper({ onProfileScraped }) {
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [profileData, setProfileData] = useState(null)

  const handleScrape = async () => {
    if (!linkedinUrl) {
      toast.error('Please enter a LinkedIn URL')
      return
    }

    setScraping(true)
    try {
      const response = await fetchJSON('/api/scraping/linkedin', {
        method: 'POST',
        body: JSON.stringify({ linkedinUrl }),
      })

      if (response.success) {
        setProfileData(response.profileData)
        if (onProfileScraped) {
          onProfileScraped(response.profileData)
        }
        toast.success('Profile data extracted!')
      } else {
        toast.error(response.message || 'Failed to scrape profile')
      }
    } catch (error) {
      console.error('LinkedIn scraping error:', error)
      toast.error('Failed to scrape LinkedIn profile. See console for details.')
    } finally {
      setScraping(false)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="text-lg font-semibold text-gray-900">LinkedIn Profile Scraper</h3>
      <p className="text-sm text-gray-600">
        Enter a LinkedIn profile URL to automatically extract candidate information.
      </p>

      <div className="flex gap-2">
        <input
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/username"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleScrape}
          disabled={scraping || !linkedinUrl}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scraping ? 'Scraping...' : 'Scrape Profile'}
        </button>
      </div>

      {profileData && (
        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Extracted Data:</p>
          <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(profileData, null, 2)}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Note: LinkedIn scraping requires API access or third-party service integration.
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>💡 Implementation Options:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Apify LinkedIn Profile Scraper</li>
          <li>ScraperAPI or Bright Data</li>
          <li>LinkedIn Official API (requires partnership)</li>
        </ul>
      </div>
    </div>
  )
}

