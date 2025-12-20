import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '../fetch.js'
import toast from 'react-hot-toast'

export const candidateKeys = {
  all: ['candidates'],
  lists: () => [...candidateKeys.all, 'list'],
  list: (filters) => [...candidateKeys.lists(), { filters }],
  details: () => [...candidateKeys.all, 'detail'],
  detail: (id) => [...candidateKeys.details(), id],
}

export function useCandidates(filters = {}) {
  return useQuery({
    queryKey: candidateKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.search) params.append('search', filters.search)
      if (filters.skills) params.append('skills', filters.skills)
      
      const res = await fetchJSON(`/api/candidates?${params}`)
      return Array.isArray(res) ? res : (res.data || [])
    },
  })
}

export function useCandidate(id) {
  return useQuery({
    queryKey: candidateKeys.detail(id),
    queryFn: async () => {
      return await fetchJSON(`/api/candidates/${id}`)
    },
    enabled: !!id,
  })
}

export function useCreateCandidate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => {
      return await fetchJSON('/api/candidates', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.lists() })
      toast.success('Candidate created successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create candidate')
    },
  })
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await fetchJSON(`/api/candidates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: candidateKeys.lists() })
      toast.success('Candidate updated successfully!')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update candidate')
    },
  })
}

