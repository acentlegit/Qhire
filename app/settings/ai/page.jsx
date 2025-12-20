'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DashboardLayout from '../../../components/layout/DashboardLayout.jsx'

export default function AIGovernancePage() {
  const { data: session } = useSession()
  const [usageData, setUsageData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsageData()
  }, [])

  const loadUsageData = async () => {
    try {
      const res = await fetch('/api/ai/usage')
      if (res.ok) {
        const data = await res.json()
        setUsageData(data)
      }
    } catch (error) {
      console.error('Error loading AI usage:', error)
    } finally {
      setLoading(false)
    }
  }

  const aiProvider = process.env.NEXT_PUBLIC_AI_PROVIDER || 'llm-core'

  return (
    <DashboardLayout title="AI Governance">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Governance</h1>
          <p className="text-gray-500 mt-1">Monitor AI usage, costs, and decision logs</p>
        </div>

        {/* AI Provider Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AI Provider Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Current Provider</p>
              <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {aiProvider === 'openai' ? 'OpenAI' : 'Groq LLM'}
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Model</p>
              <p className="text-lg font-semibold text-gray-900">
                {aiProvider === 'openai' ? 'GPT-4' : 'Llama 3.1 8B'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <p className="text-lg font-semibold text-green-600">Active</p>
            </div>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Usage Statistics</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">Total Requests</p>
                <p className="text-2xl font-bold text-blue-700">
                  {usageData?.totalRequests || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 mb-1">Tokens Used</p>
                <p className="text-2xl font-bold text-green-700">
                  {usageData?.totalTokens?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-purple-700">
                  ${usageData?.totalCost?.toFixed(4) || '0.00'}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600 mb-1">Avg Response Time</p>
                <p className="text-2xl font-bold text-orange-700">
                  {usageData?.avgResponseTime || '0'}ms
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AI Features Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AI Features</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'AI Chat Assistant', status: 'enabled', desc: 'Context-aware chat for recruiting' },
              { name: 'Resume Parsing', status: 'enabled', desc: 'Extract info from resumes' },
              { name: 'Candidate Matching', status: 'enabled', desc: 'AI-powered job matching' },
              { name: 'AI Interview Questions', status: 'enabled', desc: 'Generate interview questions' },
              { name: 'Embeddings', status: 'enabled', desc: 'Semantic search capabilities' },
              { name: 'Job Description Generator', status: 'enabled', desc: 'AI-assisted job creation' },
            ].map((feature) => (
              <div key={feature.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{feature.name}</p>
                  <p className="text-xs text-gray-500">{feature.desc}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  feature.status === 'enabled' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {feature.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Principles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AI Governance Principles</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-gray-900">AI Suggests, Human Decides</p>
                <p className="text-xs text-gray-500">All AI recommendations require human approval</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-gray-900">AI Always Explainable</p>
                <p className="text-xs text-gray-500">Every AI decision includes reasoning</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-gray-900">AI Actions Logged</p>
                <p className="text-xs text-gray-500">Complete audit trail of AI interactions</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-gray-900">AI Can Be Disabled</p>
                <p className="text-xs text-gray-500">Admin can turn off AI features anytime</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
