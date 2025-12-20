'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../lib/fetch.js'
import DashboardLayout from '../../components/layout/DashboardLayout.jsx'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#6B7280']

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [selectedJob, setSelectedJob] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    if (session) {
      fetchJobs()
      fetchMetrics()
    }
  }, [session, dateRange, selectedJob])

  const fetchJobs = async () => {
    try {
      const data = await fetchJSON('/api/jobs')
      const jobsData = Array.isArray(data) ? data : (data.jobs || data.data || [])
      setJobs(jobsData)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: dateRange })
      if (selectedJob) params.append('jobId', selectedJob)
      
      const response = await fetchJSON(`/api/analytics/metrics?${params}`)
      setMetrics(response)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendText = (current, previous) => {
    if (!previous || previous === 0) return 'No change'
    const change = ((current - previous) / previous * 100).toFixed(0)
    if (change > 0) return `↑ ${Math.abs(change)}% vs last period`
    if (change < 0) return `↓ ${Math.abs(change)}% vs last period`
    return 'No change'
  }

  const userRole = session?.user?.role
  const isHiringManager = userRole === 'HIRING_MANAGER'

  if (loading) {
    return (
      <DashboardLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!metrics) {
    return (
      <DashboardLayout title="Analytics">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400">No analytics data available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Start adding candidates and jobs to see metrics</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Analytics">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📊 Analytics
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Track your hiring performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Job Filter */}
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Jobs</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>

            {/* Date Range */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              {[
                { label: '7 days', value: '7' },
                { label: '30 days', value: '30' },
                { label: '90 days', value: '90' },
                { label: 'Custom', value: 'custom' }
              ].map(range => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    dateRange === range.value
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Applications"
            value={metrics.totalApplications || 0}
            trend={getTrendText(metrics.totalApplications, metrics.previousApplications)}
            icon="📥"
            color="blue"
          />
          <MetricCard
            title="Hires"
            value={metrics.totalHires || 0}
            trend={getTrendText(metrics.totalHires, metrics.previousHires)}
            icon="✅"
            color="green"
          />
          <MetricCard
            title="Time to Hire"
            value={metrics.avgTimeToHire ? `${metrics.avgTimeToHire} days` : 'N/A'}
            trend={metrics.avgTimeToHire ? 'Average across all hires' : 'No data'}
            icon="⏱"
            color="orange"
          />
          <MetricCard
            title="Conversion %"
            value={metrics.conversionRate ? `${metrics.conversionRate}%` : '0%'}
            trend={getTrendText(metrics.conversionRate, metrics.previousConversionRate)}
            icon="📈"
            color="purple"
          />
        </div>

        {/* Hiring Funnel */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Hiring Funnel</h2>
          <HiringFunnel data={metrics.funnelData || []} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications by Source (Hidden for Hiring Manager) */}
          {!isHiringManager && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Applications by Source</h2>
              {metrics.sourceData && metrics.sourceData.length > 0 ? (
                <ApplicationsBySource data={metrics.sourceData} />
              ) : (
                <EmptyState message="Source data will appear once candidates are added" />
              )}
            </div>
          )}

          {/* Time to Hire Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Time to Hire Trend</h2>
            {metrics.timeToHireTrend && metrics.timeToHireTrend.length > 0 ? (
              <TimeToHireTrend data={metrics.timeToHireTrend} />
            ) : (
              <EmptyState message="Time to hire data will appear once candidates are hired" />
            )}
          </div>
        </div>

        {/* AI Insights (Optional) */}
        {metrics.aiInsights && metrics.aiInsights.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              🧠 AI Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.aiInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl ${
                    insight.type === 'insight'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{insight.type === 'insight' ? '🧠' : '⚠️'}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {insight.type === 'insight' ? 'Insight' : 'Bottleneck'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{insight.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

// Metric Card Component
function MetricCard({ title, value, trend, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{trend}</p>
      </div>
    </div>
  )
}

// Hiring Funnel Component
function HiringFunnel({ data }) {
  const stages = [
    { name: 'Applied', key: 'Applied' },
    { name: 'Screen', key: 'Screen' },
    { name: 'Interview', key: 'Interview' },
    { name: 'Offer', key: 'Offer' },
    { name: 'Hired', key: 'Hired' }
  ]

  const maxCount = Math.max(...stages.map(s => {
    const stageData = data.find(d => d.stage === s.name || d.stage === s.key)
    return stageData?.count || 0
  }), 1)

  return (
    <div className="space-y-4">
      {/* Funnel Visualization */}
      <div className="flex items-end justify-between gap-2 h-64">
        {stages.map((stage, i) => {
          const stageData = data.find(d => d.stage === stage.name || d.stage === stage.key)
          const count = stageData?.count || 0
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
          const dropRate = i > 0 ? (() => {
            const prevStage = data.find(d => d.stage === stages[i - 1].name || d.stage === stages[i - 1].key)
            const prevCount = prevStage?.count || 0
            return prevCount > 0 ? ((prevCount - count) / prevCount * 100).toFixed(0) : 0
          })() : 0

          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center group">
              <div
                className="w-full rounded-t-xl transition-all hover:opacity-80 cursor-pointer relative"
                style={{
                  height: `${Math.max(percentage, 5)}%`,
                  background: `linear-gradient(to top, ${COLORS[i]}, ${COLORS[i]}88)`,
                  minHeight: '40px'
                }}
                title={`${count} candidates${dropRate > 0 && i > 0 ? ` (${dropRate}% drop)` : ''}`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{count}</span>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center">
                {stage.name}
              </p>
              {dropRate > 0 && i > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {dropRate}% drop
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Rejected (Separate) */}
      {(() => {
        const rejectedData = data.find(d => d.stage === 'Rejected' || d.stage === 'REJECTED')
        const rejectedCount = rejectedData?.count || 0
        if (rejectedCount === 0) return null
        
        return (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rejected</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{rejectedCount}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// Applications by Source Component
function ApplicationsBySource({ data }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0)

  return (
    <div className="flex items-center gap-8">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#fff'
              }}
              formatter={(value) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, 'Applications']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3 min-w-[150px]">
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0
          return (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              ></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{percentage}%</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Time to Hire Trend Component
function TimeToHireTrend({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: '#6B7280' }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value) => [`${value} days`, 'Avg Time to Hire']}
          labelFormatter={(label) => label}
        />
        <Line
          type="monotone"
          dataKey="days"
          stroke="#3B82F6"
          strokeWidth={3}
          dot={{ fill: '#3B82F6', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Empty State Component
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}
