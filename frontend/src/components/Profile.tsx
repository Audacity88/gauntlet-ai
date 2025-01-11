import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { LoadingScreen } from './LoadingScreen'

export default function Profile() {
  const { user } = useAuth()
  const { profile, loading, error, updateProfile, getProfile } = useProfile()
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    full_name: ''
  })

  useEffect(() => {
    if (user) {
      getProfile()
    }
  }, [user, getProfile])

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || ''
      })
    }
  }, [profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await updateProfile({
        username: formData.username,
        full_name: formData.full_name
      })
      setEditing(false)
    } catch (err) {
      console.error('Failed to update profile:', err)
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className="p-4 text-red-500" role="alert">
        <p className="font-medium">Error loading profile</p>
        <p className="mt-1">{error.message}</p>
        <button
          onClick={getProfile}
          className="mt-2 text-red-600 hover:text-red-700 font-medium"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 text-gray-500">
        No profile found
      </div>
    )
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label 
            htmlFor="fullName" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Changes
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{profile.full_name}</h2>
          <p className="text-gray-500">@{profile.username}</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Edit Profile
        </button>
      </div>
    </div>
  )
} 