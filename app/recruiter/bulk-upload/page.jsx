'use client'

import { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import DashboardLayout from '../../../components/layout/DashboardLayout.jsx'
import BulkResumeUpload from '../../../components/recruiter/BulkResumeUpload.jsx'

function BulkUploadContent() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
    } else if (session.user?.role !== 'RECRUITER' && session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <DashboardLayout title="Bulk Upload">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || (session.user?.role !== 'RECRUITER' && session.user?.role !== 'ADMIN')) {
    return null
  }

  return (
    <DashboardLayout title="Bulk Upload">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bulk Resume Upload
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Upload multiple resumes and let AI create candidate profiles
          </p>
        </div>

        {/* Main Upload Component */}
        <BulkResumeUpload 
          onComplete={(results) => {
            console.log('Bulk upload complete:', results)
          }}
        />
      </div>
    </DashboardLayout>
  )
}

export default function BulkUploadPage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="Bulk Upload">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    }>
      <BulkUploadContent />
    </Suspense>
  )
}
