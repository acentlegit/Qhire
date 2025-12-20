'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function PermissionsPage() {
  const { data: session } = useSession()

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Access denied. Admin privileges required.</p>
        </div>
      </div>
    )
  }

  const permissions = [
    {
      role: 'ADMIN',
      description: 'Full system access',
      permissions: ['All permissions']
    },
    {
      role: 'RECRUITER',
      description: 'Manage recruitment pipeline',
      permissions: ['Create jobs', 'Manage candidates', 'Schedule interviews', 'Create offers', 'View pipeline']
    },
    {
      role: 'HIRING_MANAGER',
      description: 'Review and approve candidates',
      permissions: ['Review candidates', 'Approve offers', 'Provide feedback', 'View pipeline']
    }
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Role Permissions</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-gray-600 mb-6">
          Configure access controls for different user roles in the system.
        </p>
        
        <div className="space-y-4">
          {permissions.map((perm) => (
            <div key={perm.role} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{perm.role}</h3>
                  <p className="text-sm text-gray-600">{perm.description}</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                  {perm.role}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                <ul className="list-disc list-inside space-y-1">
                  {perm.permissions.map((p, idx) => (
                    <li key={idx} className="text-sm text-gray-600">{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

