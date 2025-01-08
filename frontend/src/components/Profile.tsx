import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function Profile() {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? null)
        const { data, error } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', user.id)
          .single()

        if (error) throw error
        if (data) {
          setUsername(data.username)
          setFullName(data.full_name)
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user')

      const updates = {
        id: user.id,
        username,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(updates)

      if (error) throw error
      setEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-md mx-auto p-4">Loading...</div>
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Profile</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Edit
          </button>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 text-sm text-gray-900">{email || 'Not set'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Username</label>
          {editing ? (
            <input
              type="text"
              value={username || ''}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          ) : (
            <p className="mt-1 text-sm text-gray-900">{username || 'Not set'}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          {editing ? (
            <input
              type="text"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          ) : (
            <p className="mt-1 text-sm text-gray-900">{fullName || 'Not set'}</p>
          )}
        </div>
        {editing && (
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={updateProfile}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
} 