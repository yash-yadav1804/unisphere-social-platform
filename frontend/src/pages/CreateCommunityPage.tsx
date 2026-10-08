import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function CreateCommunityPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/communities/', { name, description })
      navigate(`/c/${name}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create community')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Create a community</h1>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 focus-within:border-brand-500">
            <span className="text-gray-400 text-sm mr-1">c/</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s/g, '_'))}
              required
              maxLength={100}
              className="flex-1 text-sm focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 resize-none"
          />
        </div>
        <button type="submit" className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700">
          Create community
        </button>
      </form>
    </div>
  )
}
