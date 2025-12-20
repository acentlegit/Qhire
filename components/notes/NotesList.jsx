'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fetchJSON } from '../../lib/fetch.js'
import toast from 'react-hot-toast'

export default function NotesList({ candidateId, applicationId }) {
  const { data: session } = useSession()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    content: '',
    isPrivate: false
  })

  useEffect(() => {
    fetchNotes()
  }, [candidateId, applicationId])

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (candidateId) params.append('candidateId', candidateId)
      if (applicationId) params.append('applicationId', applicationId)
      
      const response = await fetchJSON(`/api/notes?${params.toString()}`)
      const notesData = Array.isArray(response) ? response : (response.data || [])
      setNotes(notesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (error) {
      console.error('Error fetching notes:', error)
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.content.trim()) {
      toast.error('Note content is required')
      return
    }

    try {
      await fetchJSON('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          candidateId: candidateId || null,
          applicationId: applicationId || null
        })
      })
      toast.success('Note created successfully')
      setFormData({ content: '', isPrivate: false })
      setShowForm(false)
      fetchNotes()
    } catch (error) {
      console.error('Error creating note:', error)
      toast.error(error.message || 'Failed to create note')
    }
  }

  const handleDelete = async (noteId) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    
    try {
      await fetchJSON(`/api/notes/${noteId}`, { method: 'DELETE' })
      toast.success('Note deleted')
      fetchNotes()
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Failed to delete note')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-200 h-20 rounded"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Notes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Create Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add a note about this candidate..."
              required
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPrivate}
                onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Private (only visible to you)</span>
            </label>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No notes yet</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {note.user?.name || 'Unknown User'}
                    </span>
                    {note.isPrivate && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        Private
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
                {(session?.user?.id === note.userId || session?.user?.role === 'ADMIN') && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="ml-4 text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

