import { useEffect, useState } from 'react';
import { MessageWithUser } from '../types/models';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

/**
 * Props for ThreadView:
 * - parentMessage: the top-level message for this thread
 * - onClose: callback to close the thread view
 */
interface ThreadViewProps {
  parentMessage: MessageWithUser;
  onClose: () => void;
}

export function ThreadView({ parentMessage, onClose }: ThreadViewProps) {
  // Check if the message is a DM by looking for user property instead of 'dm' property
  const isDM = 'user' in parentMessage;
  
  const { messages, sendMessage, isLoading, error } = useRealtimeMessages({
    channelId: parentMessage.channel_id,
    chatType: isDM ? 'dm' : 'channel',
    parentId: parentMessage.id
  });

  const handleSendReply = async (content: string) => {
    try {
      await sendMessage(content);
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
  };

  return (
    <div className="bg-white border-l shadow-md flex flex-col w-full max-w-md">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black">
          Thread on "{parentMessage.content.substring(0, 40)}"
        </h2>
        <button
          onClick={onClose}
          className="px-3 py-1 text-gray-600 hover:text-gray-800 rounded"
        >
          Close
        </button>
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <MessageBubble
          key={parentMessage.id}
          message={parentMessage}
        />
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
          />
        ))}
        {isLoading && (
          <div className="text-center py-2 text-gray-500">
            Loading messages...
          </div>
        )}
        {error && (
          <div className="text-center py-2 text-red-500">
            {error.message}
          </div>
        )}
      </div>

      {/* Reply input */}
      <div className="p-4 border-t">
        <MessageInput
          onSubmit={handleSendReply}
          onFileSelect={() => {}}
          selectedFile={null}
          isUploading={false}
          disabled={isLoading}
          placeholder={isLoading ? "Loading..." : "Reply to thread..."}
        />
      </div>
    </div>
  );
}
