import { useEffect, useMemo, useState, useCallback } from 'react';
import { useUserCache } from '../hooks/useUserCache';
import { UserPresence } from './UserPresence';
import { User } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

interface UserListProps {
  onUserSelect?: (user: User) => void;
  activeUserId?: string;
  showPresence?: boolean;
  filter?: 'all' | 'online' | 'offline';
}

export function UserList({
  onUserSelect,
  activeUserId,
  showPresence = true,
  filter = 'all'
}: UserListProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user: currentUser } = useAuth()
  const { getUser } = useUserCache()

  // Load users
  useEffect(() => {
    let mounted = true

    const loadUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .order('username')

        if (fetchError) throw fetchError

        if (mounted && data) {
          setUsers(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load users'))
          console.error('Error loading users:', err)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadUsers()

    // Subscribe to profile changes
    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        async (payload) => {
          if (payload.new && 'id' in payload.new) {
            const updatedUser = payload.new as User
            setUsers(prevUsers => {
              const userIndex = prevUsers.findIndex(u => u.id === updatedUser.id)
              if (userIndex === -1) {
                return [...prevUsers, updatedUser]
              }
              const newUsers = [...prevUsers]
              newUsers[userIndex] = { ...newUsers[userIndex], ...updatedUser }
              return newUsers
            })
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        if (filter === 'all') return true
        const userStatus = user.status || 'OFFLINE'
        return filter === 'online' ? userStatus === 'ONLINE' : userStatus === 'OFFLINE'
      })
      .sort((a, b) => {
        // Sort by status (online first) then by username
        const statusA = a.status === 'ONLINE' ? 0 : 1
        const statusB = b.status === 'ONLINE' ? 0 : 1
        if (statusA !== statusB) return statusA - statusB
        return a.username.localeCompare(b.username)
      })
  }, [users, filter])

  const handleUserClick = useCallback((user: User) => {
    if (onUserSelect && user.id !== currentUser?.id) {
      onUserSelect(user)
    }
  }, [onUserSelect, currentUser])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-200 dark:bg-gray-700 rounded-md"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 text-center">
        <p>{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 hover:text-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {filteredUsers.map(user => (
        <div
          key={user.id}
          onClick={() => handleUserClick(user)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleUserClick(user)
            }
          }}
          className={`
            flex items-center gap-3 p-2 rounded-md
            ${user.id === activeUserId ? 'bg-indigo-100 dark:bg-indigo-900' : ''}
            ${user.id !== currentUser?.id ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''}
            transition-colors duration-200
          `}
          role="button"
          tabIndex={0}
          aria-selected={user.id === activeUserId}
          aria-label={`Select ${user.username}`}
        >
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {showPresence && (
              <div className="absolute -bottom-1 -right-1">
                <UserPresence userId={user.id} size="sm" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">
                {user.username}
                {user.id === currentUser?.id && (
                  <span className="ml-2 text-xs text-gray-500">(You)</span>
                )}
              </p>
            </div>
            {user.full_name && (
              <p className="text-xs text-gray-500 truncate">
                {user.full_name}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
} 