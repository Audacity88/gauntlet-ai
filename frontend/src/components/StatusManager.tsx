import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

type Status = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY'

export function StatusManager() {
  const [status, setStatus] = useState<Status>('ONLINE')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentStatus()

    // Set offline on page unload
    const handleUnload = () => {
      updateStatus('OFFLINE')
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      updateStatus('OFFLINE')
    }
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

      if (error) {
        console.error('Error fetching status:', error)
        return
      }
      
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

      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: newStatus,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating status:', error)
        return
      }

      setStatus(newStatus)
    } catch (error) {
      console.error('Error updating status:', error)
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
        aria-label="Set your status"
      >
        <option value="ONLINE">🟢 Online</option>
        <option value="AWAY">🟡 Away</option>
        <option value="BUSY">🔴 Busy</option>
        <option value="OFFLINE">⚫ Offline</option>
      </select>
    </div>
  )
} 