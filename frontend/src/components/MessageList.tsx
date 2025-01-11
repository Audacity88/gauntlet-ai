import { memo, useEffect, useRef, useState } from 'react';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageBubble } from './MessageBubble';
import { useFileUpload } from '../hooks/useFileUpload';
import { useAuth } from '../hooks/useAuth';
import { SearchBar } from './SearchBar';
import { MessageInput } from './MessageInput';
import { ErrorBoundary } from './ErrorBoundary';

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
  const [markReadError, setMarkReadError] = useState<MessageError | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    scrollToBottom();
  }, [messages.length]);

  // Handle message sending
  const handleSendMessage = async (content: string) => {
    if (!user) return;
    
    try {
      setIsUploading(true);
      setUploadError(null);

      // If there's a file, upload it and send as attachment
      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        const fileMetadata = {
          filename: selectedFile.name,
          contentType: selectedFile.type,
          size: selectedFile.size
        };
        await sendMessage('', uploadResult.url, fileMetadata);
        setSelectedFile(null); // Clear the selected file after upload
      } 
      // Otherwise send as text message
      else if (content.trim()) {
        await sendMessage(content);
      }
    } catch (err) {
      setUploadError({
        code: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Failed to send message',
        retry: async () => {
          await handleSendMessage(content);
        }
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  };

  // Show error states
  if (messagesError) {
    const isAccessError = messagesError.message === 'Not a member of this channel';
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div 
          className="text-red-500 mb-4"
          role="alert"
        >
          {isAccessError ? (
            'You are not a member of this channel. Please join the channel to view messages.'
          ) : (
            `Error loading messages: ${messagesError.message}`
          )}
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
      <div 
        className="flex flex-col space-y-4 p-4"
        role="status"
        aria-label="Loading messages"
      >
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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <SearchBar
          onSearch={setSearchQuery}
          placeholder="Search messages..."
        />
      </div>
      
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load more messages indicator */}
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => {
                const oldestMessage = messages[0];
                if (oldestMessage) {
                  const timestamp = oldestMessage.created_at;
                  // loadMore(timestamp); // Removed since loadMore is not available
                }
              }}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 rounded-md border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                'Load More'
              )}
            </button>
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
          <div 
            className="text-sm text-red-500 flex items-center justify-between"
            role="alert"
          >
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