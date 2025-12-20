import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '../lib/auth.js'

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Welcome to QHire</h1>
          <p className="text-xl text-gray-600 mb-2">Your AI-Powered Recruitment Management Platform</p>
          <p className="text-gray-500 mb-8">Streamline hiring with intelligent candidate matching and automated workflows</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Get Started</h2>
          <p className="text-gray-600 mb-6">Sign in to access your personalized dashboard based on your role:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold text-blue-900">👔 Admin</p>
              <p className="text-sm text-gray-600">System overview & user management</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="font-semibold text-green-900">💼 Recruiter</p>
              <p className="text-sm text-gray-600">Pipeline & candidate management</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="font-semibold text-purple-900">🎯 Hiring Manager</p>
              <p className="text-sm text-gray-600">Review candidates & approve offers</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="font-semibold text-indigo-900">👤 Candidate</p>
              <p className="text-sm text-gray-600">Track your applications</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link 
            href="/auth/signin"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
          >
            Sign In to Dashboard
          </Link>
          <Link 
            href="/auth/signup"
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}

