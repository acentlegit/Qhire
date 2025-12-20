'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout.jsx'
import AdminDashboard from '../../components/dashboard/AdminDashboard.jsx'
import RecruiterDashboard from '../../components/dashboard/RecruiterDashboard.jsx'
import HiringManagerDashboard from '../../components/dashboard/HiringManagerDashboard.jsx'

export default function DashboardPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    redirect('/auth/signin')
  }

  const userRole = session?.user?.role

  // Only Admin, Recruiter, and Hiring Manager have dashboard access
  if (!['ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(userRole)) {
    return (
      <DashboardLayout title="Access Denied">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-8 rounded-xl text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-lg mb-2">
            Your role ({userRole}) does not have access to the dashboard.
          </p>
          <p className="text-sm">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  const getDashboardTitle = () => {
    switch (userRole) {
      case 'ADMIN': return 'Admin Dashboard'
      case 'RECRUITER': return 'Recruiter Dashboard'
      case 'HIRING_MANAGER': return 'Hiring Manager Dashboard'
      default: return 'Dashboard'
    }
  }

  return (
    <DashboardLayout title={getDashboardTitle()}>
      {userRole === 'ADMIN' && <AdminDashboard />}
      {userRole === 'RECRUITER' && <RecruiterDashboard />}
      {userRole === 'HIRING_MANAGER' && <HiringManagerDashboard />}
    </DashboardLayout>
  )
}
