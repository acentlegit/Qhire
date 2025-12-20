'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Shared Dashboard Header Component
 * Sticky filters, search, export, user menu
 */
export default function DashboardHeader({ 
  title, 
  subtitle,
  onSearch,
  onFilter,
  onExport,
  showFilters = true,
  showSearch = true,
  showExport = false
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterStage, setFilterStage] = useState('')

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    if (onSearch) onSearch(value)
  }

  const handleFilterChange = (type, value) => {
    if (type === 'job') {
      setFilterJob(value)
      if (onFilter) onFilter({ job: value, stage: filterStage })
    } else if (type === 'stage') {
      setFilterStage(value)
      if (onFilter) onFilter({ job: filterJob, stage: value })
    }
  }

  const handleExport = () => {
    if (onExport) {
      onExport({ search: searchQuery, job: filterJob, stage: filterStage })
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 mb-6">
      <div className="p-4">
        {/* Title & Date */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          {showSearch && (
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}

          {showFilters && (
            <>
              <select
                value={filterJob}
                onChange={(e) => handleFilterChange('job', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Jobs</option>
                {/* Jobs will be populated dynamically */}
              </select>

              <select
                value={filterStage}
                onChange={(e) => handleFilterChange('stage', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Stages</option>
                <option value="Applied">Applied</option>
                <option value="Screen">Screen</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Hired">Hired</option>
                <option value="Rejected">Rejected</option>
              </select>
            </>
          )}

          {showExport && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

