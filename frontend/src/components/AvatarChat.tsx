import { useState, useCallback } from 'react';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { UserList } from './UserList';
import { User } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { supabase } from '../lib/supabaseClient';

interface AvatarChatProps {
  className?: string;
}

export function AvatarChat({ className = '' }: AvatarChatProps) {
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { createDirectMessage } = useDirectMessages();

  const {
    messages,
    isLoading,
    error,
    sendMessage
  } = useRealtimeMessages({
    channelId: targetUser?.channelId || '',
    chatType: 'dm'  // Always use DM mode
  });

  const handleUserSelect = useCallback(async (user: User) => {
    try {
      setTargetUser(null); // Reset current user first

      // Create or get existing DM channel
      const channelId = await createDirectMessage(user.username);

      // Wait for channel to be fully created and members added
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update target user with channel ID
      setTargetUser({ ...user, channelId });
      setMessageId(null); // Reset message context
    } catch (err) {
      console.error('Failed to create/get DM channel:', err);
      alert(err instanceof Error ? err.message : 'Failed to create direct message');
    }
  }, [createDirectMessage]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!targetUser) {
      alert('Please select a target user first');
      return;
    }

    try {
      // First send message to the channel for display
      await sendMessage(content);

      // Send to avatar API using the same endpoint as chat_cli.py
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
        },
        body: JSON.stringify({
          message: content,
          target_user_id: targetUser.id,
          message_id: messageId,
          stream: isStreaming
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(5));
                  if (data.content) {
                    streamedContent += data.content;
                    // Update the message in real-time
                    await sendMessage(streamedContent, { sender: targetUser });
                  }
                } catch (e) {
                  console.error('Error parsing streaming data:', e);
                }
              }
            }
          }
        }
      } else {
        // Handle regular response
        const data = await response.json();
        await sendMessage(data.content, { sender: targetUser });

        // Update message context
        if (data.message_id) {
          setMessageId(data.message_id);
        }
      }

    } catch (err) {
      console.error('Failed to send message:', err);
      alert(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [targetUser, sendMessage, messageId, isStreaming]);

  const handleToggleStreaming = useCallback(() => {
    setIsStreaming(prev => !prev);
  }, []);

  const handleClearContext = useCallback(() => {
    setMessageId(null);
  }, []);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r flex flex-col overflow-hidden">
        {/* Scrollable user list section */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-black mb-4">Target User</h2>
            <UserList
              onUserSelect={handleUserSelect}
              showPresence={true}
              filter="all"
              selectedUserId={targetUser?.id}
            />
          </div>
        </div>

        {/* Fixed controls section */}
        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Streaming Mode</span>
              <button
                onClick={handleToggleStreaming}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  isStreaming ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    isStreaming ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleClearContext}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Clear Context
            </button>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current State</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Target: {targetUser?.username || 'Not set'}</p>
                <p>Message ID: {messageId || 'None'}</p>
                <p>Streaming: {isStreaming ? 'On' : 'Off'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {targetUser ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <MessageList
                channelId={targetUser.channelId}
                chatType="dm"
                chatName={targetUser.username}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a target user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}