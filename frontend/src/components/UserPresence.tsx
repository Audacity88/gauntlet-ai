import { memo, useEffect, useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import { UserStatus } from '../utils/PresenceManager';
import { formatDistanceToNow } from 'date-fns';
import { useUserStore } from '../stores/userStore';

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
  const { users } = useUserStore();
  const { getUserStatus, getLastSeen } = usePresence();
  const [status, setStatus] = useState<UserStatus>(getUserStatus(userId));
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(getLastSeen(userId));

  // Subscribe to user status changes
  useEffect(() => {
    const user = users.get(userId);
    if (user?.status) {
      setStatus(user.status as UserStatus);
    }
    if (user?.last_seen) {
      setLastSeenTime(user.last_seen);
    }
  }, [userId, users]);

  const { bg, ring } = statusColors[status];
  const label = statusLabels[status];
  const sizeClass = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          relative flex shrink-0 ${sizeClass}
          ${bg} rounded-full ring-2 ${ring}
          transition-colors duration-200
        `}
        role="status"
        aria-label={label}
      />
      
      {showLastSeen && status === 'OFFLINE' && lastSeenTime && (
        <span className="text-xs text-gray-500">
          Last seen {formatDistanceToNow(new Date(lastSeenTime), { addSuffix: true })}
        </span>
      )}
    </div>
  );
}); 