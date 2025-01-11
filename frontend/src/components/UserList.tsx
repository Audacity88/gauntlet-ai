import { useEffect, useMemo, useState, useCallback } from 'react';
import { useUserCache } from '../hooks/useUserCache';
import { usePresence } from '../hooks/usePresence';
import { UserPresence } from './UserPresence';
import { User } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { UserStatus } from '../utils/PresenceManager';
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
  const { user: currentUser } = useAuth();
  const { isLoading: isCacheLoading, error, setError, getUser, setUser } = useUserCache();
  const { getUserStatus } = usePresence();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*');
      
      if (fetchError) throw fetchError;
      
      if (data) {
        const validUsers = data.filter((user: User) => {
          try {
            const cachedUser = getUser(user.id);
            if (!cachedUser) {
              setUser(user.id, user);
              return true;
            }
            return true;
          } catch {
            setUser(user.id, user);
            return true;
          }
        });
        setUsers(validUsers);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch users'));
    } finally {
      setIsLoadingUsers(false);
    }
  }, [getUser, setUser, setError]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!users.length) return [];
    
    return users
      .filter((user: User) => {
        if (!currentUser || user.id === currentUser.id) return false;
        
        const status = getUserStatus(user.id);
        if (filter === 'online') return status !== 'OFFLINE';
        if (filter === 'offline') return status === 'OFFLINE';
        return true;
      })
      .sort((a: User, b: User) => {
        const statusA = getUserStatus(a.id);
        const statusB = getUserStatus(b.id);
        
        if (statusA === statusB) {
          return a.username.localeCompare(b.username);
        }
        
        return statusA === 'OFFLINE' ? 1 : -1;
      });
  }, [users, currentUser, filter, getUserStatus]);

  const isLoading = isCacheLoading || isLoadingUsers;

  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading users">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-100 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="p-4 text-sm text-red-500 bg-red-50 rounded-lg"
        role="alert"
        aria-live="polite"
      >
        <p className="font-medium">Failed to load users</p>
        <p className="mt-1">{error.message}</p>
        <button
          onClick={fetchUsers}
          className="mt-2 text-red-600 hover:text-red-700 font-medium"
          aria-label="Retry loading users"
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!users.length || filteredUsers.length === 0) {
    return (
      <div 
        className="p-4 text-sm text-gray-500 bg-gray-50 rounded-lg"
        role="status"
      >
        {filter !== 'all' 
          ? `No ${filter} users found`
          : 'No users found'}
      </div>
    );
  }

  return (
    <div className="space-y-1" role="list">
      {filteredUsers.map((user: User) => (
        <button
          key={user.id}
          onClick={() => onUserSelect?.(user)}
          onKeyDown={(e) => e.key === 'Enter' && onUserSelect?.(user)}
          className={`
            w-full flex items-center gap-3 p-2 rounded-lg
            transition-colors duration-200
            ${activeUserId === user.id
              ? 'bg-indigo-50 text-indigo-700'
              : 'hover:bg-gray-50'
            }
          `}
          aria-selected={activeUserId === user.id}
          role="listitem"
          tabIndex={0}
        >
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={`${user.username}'s avatar`}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            {showPresence && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <UserPresence userId={user.id} size="sm" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="font-medium truncate">
              {user.full_name || user.username}
            </div>
            {user.full_name && (
              <div className="text-sm text-gray-500 truncate">
                @{user.username}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
} 