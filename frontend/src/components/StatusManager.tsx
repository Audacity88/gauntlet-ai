import { useState, useEffect, useCallback } from 'react'
import { useUserCache } from '../hooks/useUserCache'
import { useAuth } from '../hooks/useAuth'
import { useDebounce } from '../hooks/useDebounce'
import { supabase } from '../lib/supabaseClient'
import { useStatusStore } from '../stores/statusStore'

export type UserStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'

export function StatusManager() {
  const { user: currentUser } = useAuth()
  const { updateUserStatus } = useUserCache()
  const setUserStatus = useStatusStore(state => state.setUserStatus)
  const [status, setStatus] = useState<UserStatus>('ONLINE')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialMount, setIsInitialMount] = useState(true)

  const updateStatus = useCallback(async (newStatus: UserStatus) => {
    if (!currentUser) return
    
    try {
      // Update database - convert to lowercase for database storage
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: newStatus.toLowerCase() })
        .eq('id', currentUser.id)

      if (updateError) throw updateError
      
      // Update cache - keep uppercase for frontend
      await updateUserStatus(currentUser.id, newStatus)
      return true
    } catch (err) {
      console.error('Error updating status:', err)
      throw err
    }
  }, [currentUser, updateUserStatus])

  const handleStatusChange = useCallback(async (newStatus: UserStatus) => {
    if (!currentUser) return
    
    try {
      setUpdating(true)
      setError(null)
      
      // Update local state immediately
      setStatus(newStatus)
      setUserStatus(currentUser.id, newStatus)
      
      await updateStatus(newStatus)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update status'))
      // Revert status on error
      setStatus(status)
      setUserStatus(currentUser.id, status)
    } finally {
      setUpdating(false)
    }
  }, [currentUser, setUserStatus, updateStatus, status])

  const getCurrentStatus = useCallback(async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('status, username, full_name, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (fetchError) {
        throw fetchError
      }

      // If no profile exists yet or it's initial mount, set to online
      if (!data || isInitialMount) {
        try {
          await updateStatus('ONLINE')
          setStatus('ONLINE')
          setUserStatus(currentUser.id, 'ONLINE')
        } catch (err) {
          console.error('Error setting initial status:', err)
        }
      } else {
        // Otherwise preserve existing status - convert from lowercase in DB to uppercase for frontend
        const newStatus = (data.status || 'offline').toUpperCase() as UserStatus
        setStatus(newStatus)
        setUserStatus(currentUser.id, newStatus)
        
        // Update user cache with full profile data
        const userProfile = {
          id: currentUser.id,
          username: data.username,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          status: newStatus,
          created_at: currentUser.created_at,
          updated_at: currentUser.updated_at
        }
        await updateUserStatus(currentUser.id, newStatus)
      }

      // Mark initial mount as complete
      setIsInitialMount(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status'))
      console.error('Error fetching status:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser, setUserStatus, updateUserStatus, isInitialMount, updateStatus])

  // Handle initial status fetch
  useEffect(() => {
    if (currentUser) {
      getCurrentStatus()
    }
  }, [currentUser, getCurrentStatus])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const options: UserStatus[] = ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE']
      const currentIndex = options.indexOf(status)
      let newIndex = currentIndex

      if (e.key === 'ArrowUp') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
      } else {
        newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
      }

      handleStatusChange(options[newIndex])
    }
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as UserStatus)}
        onKeyDown={handleKeyDown}
        disabled={loading || updating}
        className={`
          bg-indigo-700 text-white text-sm rounded-md border-indigo-600 
          focus:ring-2 focus:ring-indigo-500
          ${(loading || updating) ? 'opacity-75 cursor-wait' : ''}
        `}
        aria-label="Set your status"
        aria-busy={loading || updating}
      >
        <option value="ONLINE">🟢 Online</option>
        <option value="AWAY">🟡 Away</option>
        <option value="BUSY">🔴 Busy</option>
        <option value="OFFLINE">⚫ Offline</option>
      </select>
      {(loading || updating) && (
        <div 
          className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label={loading ? "Loading status" : "Updating status"}
        />
      )}
      {error && (
        <button
          onClick={getCurrentStatus}
          className="text-red-600 hover:text-red-700 text-sm font-medium"
          aria-label="Retry loading status"
        >
          Retry
        </button>
      )}
    </div>
  )
} 