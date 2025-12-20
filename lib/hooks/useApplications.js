import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '../fetch.js'
import toast from 'react-hot-toast'

export const applicationKeys = {
  all: ['applications'],
  lists: () => [...applicationKeys.all, 'list'],
  list: (filters) => [...applicationKeys.lists(), { filters }],
  details: () => [...applicationKeys.all, 'detail'],
  detail: (id) => [...applicationKeys.details(), id],
}

export function useApplications(filters = {}) {
  return useQuery({
    queryKey: applicationKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.jobId) params.append('jobId', filters.jobId)
      if (filters.candidateId) params.append('candidateId', filters.candidateId)
      
      const res = await fetchJSON(`/api/applications?${params}`)
      return Array.isArray(res) ? res : (res.data || [])
    },
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      return await fetchJSON('/api/applications', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.lists() })
      toast.success('Application created successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create application')
    },
  })
}

export function useUpdateApplicationStage() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, stage }) => {
      return await fetchJSON(`/api/applications/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: applicationKeys.lists() })
      toast.success('Application stage updated!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update application stage')
    },
  })
}

