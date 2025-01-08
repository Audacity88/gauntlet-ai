import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

type Status = 'online' | 'offline' | 'away' | 'busy'

export function StatusManager() {
  const [status, setStatus] = useState<Status>('online')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentStatus().then(() => {
      // Update last_seen every minute
      const interval = setInterval(() => {
        updateLastSeen()
      }, 60000)

      // Set offline on page unload
      const handleUnload = () => {
        updateStatus('offline')
      }
      window.addEventListener('beforeunload', handleUnload)

      return () => {
        clearInterval(interval)
        window.removeEventListener('beforeunload', handleUnload)
        updateStatus('offline')
      }
    })
  }, [])

  async function getCurrentStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (data?.status) {
        setStatus(data.status as Status)
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus: Status) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('profiles')
        .update({ 
          status: newStatus,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id)

      setStatus(newStatus)
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  async function updateLastSeen() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
    } catch (error) {
      console.error('Error updating last_seen:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-8 w-24 bg-indigo-700 animate-pulse rounded-md"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <select
        value={status}
        onChange={(e) => updateStatus(e.target.value as Status)}
        className="bg-indigo-700 text-white text-sm rounded-md border-indigo-600 focus:ring-2 focus:ring-indigo-500"
      >
        <option value="online">🟢 Online</option>
        <option value="away">🟡 Away</option>
        <option value="busy">🔴 Busy</option>
        <option value="offline">⚫ Offline</option>
      </select>
    </div>
  )
} 