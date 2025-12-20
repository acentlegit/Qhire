'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

export default function AIUsageDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [dateRange, setDateRange] = useState('30d') // 7d, 30d, 90d, all

  useEffect(() => {
    fetchUsage()
  }, [dateRange])

  const fetchUsage = async () => {
    try {
      setLoading(true)
      
      let startDate = null
      const endDate = new Date()
      
      if (dateRange === '7d') {
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
      } else if (dateRange === '30d') {
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)
      } else if (dateRange === '90d') {
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 90)
      }

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate.toISOString())
      params.append('endDate', endDate.toISOString())

      const res = await fetch(`/api/ai/usage?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setStats(data)
      } else {
        toast.error(data.error?.message || 'Failed to load usage statistics')
      }
    } catch (error) {
      console.error('Error fetching usage:', error)
      toast.error('Failed to load usage statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-gray-500">No usage data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI Usage & Costs</h2>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card
          title="Total Tokens"
          value={stats.summary.totalTokens.toLocaleString()}
          subtitle={`${stats.summary.totalInputTokens.toLocaleString()} in / ${stats.summary.totalOutputTokens.toLocaleString()} out`}
          icon="🔢"
        />
        <Card
          title="Period Cost"
          value={`$${stats.summary.totalCost.toFixed(2)}`}
          subtitle={`${stats.summary.count} API calls`}
          icon="💰"
        />
        <Card
          title="Monthly Forecast"
          value={`$${stats.summary.monthlyForecast.toFixed(2)}`}
          subtitle="Projected this month"
          icon="📊"
        />
        <Card
          title="All-Time Cost"
          value={`$${stats.summary.totalCostAllTime.toFixed(2)}`}
          subtitle={`$${stats.summary.monthlyCost.toFixed(2)} this month`}
          icon="💳"
        />
      </div>

      {/* By Service Breakdown */}
      {stats.byService && Object.keys(stats.byService).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Usage by Service</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(stats.byService).map(([service, data]) => (
              <div
                key={service}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 capitalize">
                    {service.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">{data.count} calls</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  ${data.cost.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data.tokens.toLocaleString()} tokens
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Usage Table */}
      {stats.recentUsage && stats.recentUsage.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Recent Usage</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentUsage.map((usage) => (
                  <tr key={usage.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(usage.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">
                      {usage.service.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {usage.model || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {usage.tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">
                      ${usage.cost.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, subtitle, icon }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800 mb-1">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-500">{subtitle}</div>
      )}
    </div>
  )
}

