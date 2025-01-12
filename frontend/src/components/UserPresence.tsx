import { memo, useEffect } from 'react'
import { useStatusStore } from '../stores/statusStore'
import { UserStatus } from './StatusManager'

interface UserPresenceProps {
  userId: string
  size?: 'sm' | 'md' | 'lg'
}

const statusColors: Record<UserStatus, string> = {
  ONLINE: 'bg-green-500',
  AWAY: 'bg-yellow-500',
  BUSY: 'bg-red-500',
  OFFLINE: 'bg-gray-500'
}

const statusLabels: Record<UserStatus, string> = {
  ONLINE: 'Online',
  AWAY: 'Away',
  BUSY: 'Do not disturb',
  OFFLINE: 'Offline'
}

export const UserPresence = memo(function UserPresence({ userId, size = 'md' }: UserPresenceProps) {
  const status = useStatusStore(state => state.userStatuses[userId]) || 'OFFLINE'
  const subscribeToUserStatus = useStatusStore(state => state.subscribeToUserStatus)
  const isLoading = useStatusStore(state => state.loadingProfiles.has(userId))

  useEffect(() => {
    // Subscribe to user status changes
    const unsubscribe = subscribeToUserStatus(userId)
    return () => {
      unsubscribe()
    }
  }, [userId, subscribeToUserStatus])

  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5'
  }

  if (isLoading) {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          bg-gray-300
          rounded-full
          ring-2
          ring-offset-2
          ring-gray-200
          animate-pulse
        `}
        role="status"
        aria-label="Loading user status"
      />
    )
  }

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${statusColors[status]}
        rounded-full
        ring-2
        ring-offset-2
        ring-gray-200
      `}
      role="status"
      aria-label={statusLabels[status]}
      title={statusLabels[status]}
    />
  )
}) 