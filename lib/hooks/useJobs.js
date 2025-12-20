import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '../fetch.js'
import toast from 'react-hot-toast'

// Query keys
export const jobKeys = {
  all: ['jobs'],
  lists: () => [...jobKeys.all, 'list'],
  list: (filters) => [...jobKeys.lists(), { filters }],
  details: () => [...jobKeys.all, 'detail'],
  detail: (id) => [...jobKeys.details(), id],
}

// Fetch jobs
export function useJobs(filters = {}) {
  return useQuery({
    queryKey: jobKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.status) params.append('status', filters.status)
      
      const res = await fetchJSON(`/api/jobs?${params}`)
      return Array.isArray(res) ? res : (res.data || [])
    },
  })
}

// Fetch single job
export function useJob(id) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      return await fetchJSON(`/api/jobs/${id}`)
    },
    enabled: !!id,
  })
}

// Create job mutation
export function useCreateJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      return await fetchJSON('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      toast.success('Job created successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create job')
    },
  })
}

// Update job mutation
export function useUpdateJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await fetchJSON(`/api/jobs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      toast.success('Job updated successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update job')
    },
  })
}

// Delete job mutation
export function useDeleteJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id) => {
      return await fetchJSON(`/api/jobs/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      toast.success('Job deleted successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete job')
    },
  })
}

