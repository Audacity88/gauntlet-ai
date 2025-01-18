import { memo } from 'react';
import { useRealtimeDirectMessages } from '../hooks/useRealtimeDirectMessages';
import { useDirectMessageStore } from '../stores/directMessageStore';
import { DirectMessageWithDetails } from '../utils/DirectMessageProcessor';
import { UserPresence } from './UserPresence';
import { useAuth } from '../hooks/useAuth';

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
  const { user } = useAuth();
  const { messages, sendMessage } = useRealtimeDirectMessages({ userId });
  const { loading, error, conversations } = useDirectMessageStore();

  // Get the conversation for this user
  const conversation = conversations.get(userId);
  const conversationMessages = conversation?.messages || [];
  const otherUserProfile = conversation?.otherUserProfile;

  // Show loading state
  if (loading && !conversationMessages.length) {
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
  if (!conversationMessages.length) {
    return (
      <div className={`p-4 text-gray-500 ${className}`}>
        {otherUserProfile ? `No messages yet with ${otherUserProfile.full_name || otherUserProfile.username}. Start a conversation!` : 'No messages yet. Start a conversation!'}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {conversationMessages.map((message) => {
        if (!message || !message.id) return null;
        
        const isCurrentUser = user?.id === message.user_id;
        const messageProfile = isCurrentUser ? message.sender : otherUserProfile;
        const sender = messageProfile || {
          username: 'Unknown User',
          full_name: 'Unknown User',
          avatar_url: null
        };

        return (
          <div
            key={message.id}
            onClick={() => onMessageSelect?.(message)}
            className={`
              flex items-start space-x-3 p-4 rounded-lg
              ${isCurrentUser ? 'bg-indigo-50' : 'bg-gray-50'}
              ${onMessageSelect ? 'cursor-pointer hover:bg-gray-100' : ''}
            `}
            role="button"
            tabIndex={0}
            aria-label={`Message from ${sender.full_name || sender.username}`}
          >
            <div className="relative">
              <img
                src={sender.avatar_url || '/default-avatar.png'}
                alt={sender.username || 'User'}
                className="w-10 h-10 rounded-full"
              />
              <UserPresence
                userId={message.user_id}
                size="small"
                className="absolute -bottom-1 -right-1"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  {sender.full_name || sender.username}
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
        );
      })}
    </div>
  );
}); 