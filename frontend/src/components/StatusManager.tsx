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
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getCurrentStatus = useCallback(async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', currentUser.id)
        .single()

      if (fetchError) {
        throw fetchError
      }
      
      if (data?.status) {
        const newStatus = data.status as UserStatus
        setStatus(newStatus)
        setUserStatus(currentUser.id, newStatus)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status'))
      console.error('Error fetching status:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser, setUserStatus])

  const debouncedUpdateStatus = useDebounce(async (newStatus: UserStatus) => {
    if (!currentUser) return

    try {
      setUpdating(true)
      setError(null)
      
      // Update status in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', currentUser.id)

      if (updateError) throw updateError
      
      // Update the user cache
      await updateUserStatus(currentUser.id, newStatus)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update status'))
      // Revert status on error
      setStatus(status)
      setUserStatus(currentUser.id, status)
    } finally {
      setUpdating(false)
    }
  }, 500)

  const handleStatusChange = (newStatus: UserStatus) => {
    if (!currentUser) return
    
    console.log('StatusManager - Changing status to:', newStatus)
    
    // Update local state and store immediately
    setStatus(newStatus)
    setUserStatus(currentUser.id, newStatus)
    
    // Debounce the database update
    debouncedUpdateStatus(newStatus)
  }

  useEffect(() => {
    console.log('StatusManager - Initial status fetch for user:', currentUser?.id)
    if (currentUser) {
      getCurrentStatus()
    }

    const handleUnload = () => {
      if (currentUser) {
        handleStatusChange('OFFLINE')
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      if (currentUser) {
        handleStatusChange('OFFLINE')
      }
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

  if (loading) {
    return (
      <div 
        className="flex items-center space-x-2" 
        role="status" 
        aria-label="Loading status"
      >
        <div className="h-8 w-24 bg-indigo-700 animate-pulse rounded-md"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className="flex items-center space-x-2 text-red-500" 
        role="alert"
      >
        <span className="text-sm">{error.message}</span>
        <button
          onClick={getCurrentStatus}
          className="text-red-600 hover:text-red-700 text-sm font-medium"
          aria-label="Retry loading status"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value as UserStatus)}
        onKeyDown={handleKeyDown}
        disabled={updating}
        className={`
          bg-indigo-700 text-white text-sm rounded-md border-indigo-600 
          focus:ring-2 focus:ring-indigo-500
          ${updating ? 'opacity-75 cursor-wait' : ''}
        `}
        aria-label="Set your status"
        aria-busy={updating}
      >
        <option value="ONLINE">🟢 Online</option>
        <option value="AWAY">🟡 Away</option>
        <option value="BUSY">🔴 Busy</option>
        <option value="OFFLINE">⚫ Offline</option>
      </select>
      {updating && (
        <div 
          className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Updating status"
        />
      )}
    </div>
  )
} 