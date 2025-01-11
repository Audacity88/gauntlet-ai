import { memo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MessageWithUser, DirectMessageWithUser } from '../types/schema';
import { UserPresence } from './UserPresence';
import { ErrorBoundary } from './ErrorBoundary';

interface MessageError {
  code: string;
  message: string;
}

interface MessageBubbleProps {
  message: MessageWithUser | DirectMessageWithUser;
  onUpdate?: (messageId: string, content: string) => Promise<void>;
  isOptimistic?: boolean;
}

const MessageBubbleContent = memo(function MessageBubbleContent({
  message,
  onUpdate,
  isOptimistic = false
}: MessageBubbleProps) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<MessageError | null>(null);

  const content = 'content' in message ? message.content : message.message;
  const isCurrentUser = currentUser?.id === message.user_id;

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(content || '');
    setError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setError(null);
  };

  const handleUpdate = async () => {
    if (!onUpdate || editContent.trim() === content) {
      setIsEditing(false);
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      await onUpdate(message.id, editContent.trim());
      setIsEditing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update message';
      setError({
        code: 'UPDATE_FAILED',
        message: errorMessage
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetry = async () => {
    if (error) {
      setError(null);
      await handleUpdate();
    }
  };

  return (
    <div
      className={`flex items-start space-x-3 group ${
        isOptimistic ? 'opacity-70' : ''
      } ${
        isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        {message.user.avatar_url ? (
          <img
            src={message.user.avatar_url}
            alt={message.user.username}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-indigo-700 font-medium">
              {message.user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className={`absolute -bottom-1 ${isCurrentUser ? '-left-1' : '-right-1'}`}>
          <UserPresence
            userId={message.user_id}
            size="sm"
          />
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${isCurrentUser ? 'text-right' : ''}`}>
        <div className={`flex items-baseline ${isCurrentUser ? 'justify-end' : 'justify-between'}`}>
          <div className={`flex items-center space-x-2 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <span className="font-medium text-gray-900">
              {message.user.username}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(message.created_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </span>
          </div>
        </div>
        
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              disabled={isUpdating}
              aria-label="Edit message content"
            />
            {error && (
              <div 
                className="text-sm text-red-500 flex items-center justify-between"
                role="alert"
              >
                <span>{error.message}</span>
                <button
                  onClick={handleRetry}
                  className="text-red-600 hover:text-red-700 font-medium"
                  aria-label="Retry update"
                >
                  Retry
                </button>
              </div>
            )}
            <div className={`flex space-x-2 ${isCurrentUser ? 'justify-end' : ''}`}>
              <button
                onClick={handleUpdate}
                disabled={isUpdating || editContent.trim() === content}
                className="px-3 py-1 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                aria-label={isUpdating ? 'Saving message' : 'Save message'}
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                aria-label="Cancel editing"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={`mt-1 ${isCurrentUser ? 'flex flex-col items-end' : ''}`}>
            <div className="group/message flex items-start gap-2">
              {isCurrentUser && !isOptimistic && (
                <div className="opacity-0 group-hover/message:opacity-100 transition-opacity self-center flex-shrink-0">
                  <button
                    onClick={handleEdit}
                    disabled={isEditing || isUpdating}
                    className="p-1 text-gray-100 hover:text-gray-200 rounded-full hover:bg-gray-600"
                    aria-label="Edit message"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <div className={`inline-block max-w-[85%] px-4 py-2 rounded-lg ${
                isCurrentUser 
                  ? 'bg-indigo-600 text-left rounded-tr-none text-white' 
                  : 'bg-gray-50 rounded-tl-none'
              }`}>
                <p className={`whitespace-pre-wrap break-words ${
                  isCurrentUser ? 'text-white' : 'text-gray-900'
                }`}>
                  {content || ''}
                </p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className={`inline-flex items-center space-x-2 px-3 py-1 rounded-md ${
                          isCurrentUser ? 'bg-indigo-500/50' : 'bg-white/50'
                        }`}
                      >
                        <svg
                          className={`w-4 h-4 ${isCurrentUser ? 'text-indigo-100' : 'text-gray-500'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                        <a
                          href={attachment.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm ${
                            isCurrentUser ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                          }`}
                          aria-label={`Download ${attachment.filename || 'attachment'}`}
                        >
                          {attachment.filename || 'Attachment'}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {isOptimistic && (
              <div 
                className="mt-1 text-sm text-gray-500"
                aria-live="polite"
              >
                Sending...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const MessageBubble = memo(function MessageBubbleWrapper(props: MessageBubbleProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg">
          Failed to render message. Please try refreshing the page.
        </div>
      }
    >
      <MessageBubbleContent {...props} />
    </ErrorBoundary>
  );
}); 