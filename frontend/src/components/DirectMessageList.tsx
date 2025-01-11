import { memo } from 'react';
import { useRealtimeDirectMessages } from '../hooks/useRealtimeDirectMessages';
import { useDirectMessageStore } from '../stores/directMessageStore';
import { DirectMessageWithDetails } from '../utils/DirectMessageProcessor';
import { UserPresence } from './UserPresence';

interface DirectMessageListProps {
  userId: string;
  onMessageSelect?: (message: DirectMessageWithDetails) => void;
  className?: string;
}

export const DirectMessageList = memo(function DirectMessageList({
  userId,
  onMessageSelect,
  className = ''
}: DirectMessageListProps) {
  const { messages, sendMessage } = useRealtimeDirectMessages({ userId });
  const { loading, error } = useDirectMessageStore();

  // Show loading state
  if (loading && !messages.length) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center space-x-2 p-4 bg-gray-100 animate-pulse rounded-md"
          >
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`p-4 text-red-500 ${className}`}>
        Error: {error.message}
      </div>
    );
  }

  // Show empty state
  if (!messages.length) {
    return (
      <div className={`p-4 text-gray-500 ${className}`}>
        No messages yet. Start a conversation!
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {messages.map((message) => (
        <div
          key={message.id}
          onClick={() => onMessageSelect?.(message)}
          className={`
            flex items-start space-x-3 p-4 rounded-lg
            ${message.sender_id === userId ? 'bg-indigo-50' : 'bg-gray-50'}
            ${onMessageSelect ? 'cursor-pointer hover:bg-gray-100' : ''}
          `}
          role="button"
          tabIndex={0}
          aria-label={`Message from ${message.sender?.username}`}
        >
          <div className="relative">
            <img
              src={message.sender?.avatar_url || '/default-avatar.png'}
              alt={message.sender?.username || 'User'}
              className="w-10 h-10 rounded-full"
            />
            <UserPresence
              userId={message.sender_id}
              size="small"
              className="absolute -bottom-1 -right-1"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {message.sender?.username || 'Unknown User'}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(message.created_at).toLocaleTimeString()}
              </span>
            </div>

            <p className="mt-1 text-gray-600 break-words">
              {message.content}
            </p>

            {message.id.startsWith('temp-') && (
              <span className="text-xs text-gray-400 mt-1">
                Sending...
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}); 