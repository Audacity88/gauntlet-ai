import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageBubble } from './MessageBubble';
import { useFileUpload } from '../hooks/useFileUpload';
import { useAuth } from '../hooks/useAuth';
import { SearchBar } from './SearchBar';
import { MessageInput } from './MessageInput';
import { ErrorBoundary } from './ErrorBoundary';
import { ThreadView } from './ThreadView';
import { MessageWithUser } from '../types/models';

interface MessageError {
  code: string;
  message: string;
  retry?: () => Promise<void>;
}

interface MessageListProps {
  channelId: string;
  chatType?: 'channel' | 'dm';
  markChannelAsRead?: (channelId: string) => Promise<void>;
}

const MessageListContent = memo(function MessageListContent({
  channelId,
  chatType = 'channel',
  markChannelAsRead
}: MessageListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<MessageError | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // New state for viewing a thread
  const [threadParent, setThreadParent] = useState<MessageWithUser | null>(null);

  const { user } = useAuth();
  const { uploadFile } = useFileUpload();

  const {
    messages,
    isLoading,
    error: messagesError,
    hasMore,
    sendMessage
  } = useRealtimeMessages({ channelId, chatType, searchQuery });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!searchQuery) {
      scrollToBottom();
    }
  }, [messages.length, searchQuery]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle message sending
  const handleSendMessage = async (content: string) => {
    if (!user) return;
    
    try {
      if (selectedFile) {
        setIsUploading(true);
        setUploadError(null);
        
        let uploadResult;
        try {
          uploadResult = await uploadFile(selectedFile);
          if (!uploadResult?.url) {
            throw new Error('Failed to get upload URL');
          }
        } catch (uploadErr) {
          console.error('Upload error:', uploadErr);
          setUploadError({
            code: 'UPLOAD_FAILED',
            message: uploadErr instanceof Error ? uploadErr.message : 'Failed to upload file',
            retry: async () => {
              await handleSendMessage(content);
            }
          });
          return; // Don't proceed with message send if upload failed
        }
        
        // Only proceed with message send if upload was successful
        const fileMetadata = {
          filename: selectedFile.name,
          contentType: selectedFile.type,
          size: selectedFile.size
        };
        
        try {
          await sendMessage(content || ' ', uploadResult.url, fileMetadata);
          setSelectedFile(null);
        } catch (sendErr) {
          console.error('Send error:', sendErr);
          setUploadError({
            code: 'SEND_FAILED',
            message: sendErr instanceof Error ? sendErr.message : 'Failed to send message',
            retry: async () => {
              await handleSendMessage(content);
            }
          });
        }
      } else if (content.trim()) {
        await sendMessage(content);
      }
    } catch (err) {
      console.error('General error:', err);
      setUploadError({
        code: 'GENERAL_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        retry: async () => {
          await handleSendMessage(content);
        }
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  };

  // Called when user clicks "Reply in thread"
  const openThread = (parentMessage: MessageWithUser) => {
    setThreadParent(parentMessage);
  };

  // Close thread view
  const closeThread = () => {
    setThreadParent(null);
  };

  // Show error states
  if (messagesError) {
    const isAccessError = messagesError.message === 'Not a member of this channel';
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-red-500 mb-4" role="alert">
          {isAccessError
            ? 'You are not a member of this channel. Please join the channel to view messages.'
            : `Error loading messages: ${messagesError.message}`}
        </div>
        {!isAccessError && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Show loading state
  if (isLoading && !messages.length) {
    return (
      <div className="flex flex-col space-y-4 p-4" role="status" aria-label="Loading messages">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main area: messages + input */}
      <div className="flex-1 flex flex-col">
        {/* Search bar */}
        <div className="p-4 border-b">
          <SearchBar onSearch={handleSearch} placeholder="Search messages..." />
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Load more messages indicator, etc. (optional) */}

          {/* No results message when searching */}
          {searchQuery && messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <p>No messages found matching "{searchQuery}"</p>
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <MessageBubble
              key={`${channelId}-${message.id}`}
              message={{
                ...message,
                profile: message.user,
                profile_id: message.user_id
              }}
              isOptimistic={message.id.startsWith('temp-')}
              onOpenThread={(m) => openThread(m as MessageWithUser)}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t">
          <MessageInput
            onSubmit={handleSendMessage}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            isUploading={isUploading}
          />
          {uploadError && (
            <div className="text-sm text-red-500 flex items-center justify-between" role="alert">
              <span>{uploadError.message}</span>
              {uploadError.retry && (
                <button
                  onClick={uploadError.retry}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Retry Upload
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Optional side panel for threads */}
      {threadParent && (
        <ThreadView parentMessage={threadParent} onClose={closeThread} />
      )}
    </div>
  );
});

export const MessageList = memo(function MessageListWrapper(props: MessageListProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="text-red-500 mb-4">
            Something went wrong with the message list.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Reload Page
          </button>
        </div>
      }
    >
      <MessageListContent key={`${props.channelId}-${props.chatType}`} {...props} />
    </ErrorBoundary>
  );
});
