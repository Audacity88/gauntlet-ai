import { memo, useMemo } from 'react';
import { useUserCache } from '../hooks/useUserCache';

export type UserStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

interface UserPresenceProps {
  userId: string;
  showLastSeen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<UserStatus, { bg: string; ring: string }> = {
  ONLINE: { bg: 'bg-green-500', ring: 'ring-green-300' },
  AWAY: { bg: 'bg-yellow-500', ring: 'ring-yellow-300' },
  BUSY: { bg: 'bg-red-500', ring: 'ring-red-300' },
  OFFLINE: { bg: 'bg-gray-500', ring: 'ring-gray-300' }
};

const statusLabels: Record<UserStatus, string> = {
  ONLINE: 'Online',
  AWAY: 'Away',
  BUSY: 'Do not disturb',
  OFFLINE: 'Offline'
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
};

export const UserPresence = memo(function UserPresence({
  userId,
  showLastSeen = false,
  size = 'md'
}: UserPresenceProps) {
  const { getUser } = useUserCache();
  
  const userInfo = useMemo(() => {
    const user = getUser(userId);
    const status = (user?.status || 'OFFLINE') as UserStatus;
    const colors = statusColors[status];
    const label = statusLabels[status];
    const sizeClass = sizeClasses[size];
    
    return {
      user,
      status,
      colors,
      label,
      sizeClass
    };
  }, [userId, getUser, size]);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          ${userInfo.sizeClass}
          ${userInfo.colors.bg}
          rounded-full ring-2 ring-offset-2
          ${userInfo.colors.ring}
        `}
        role="status"
        aria-label={userInfo.label}
        title={userInfo.label}
      />
      {showLastSeen && userInfo.user?.last_seen && userInfo.status === 'OFFLINE' && (
        <span className="text-xs text-gray-500">
          Last seen: {new Date(userInfo.user.last_seen).toLocaleString()}
        </span>
      )}
    </div>
  );
}); 