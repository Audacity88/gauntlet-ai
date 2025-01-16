import { useState, useCallback, useEffect } from 'react';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageList } from './MessageList';
import { UserList } from './UserList';
import { User } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { supabase } from '../lib/supabaseClient';

interface AvatarChatProps {
  className?: string;
}

interface TargetUser extends User {
  channelId: string;
}

interface MessageHistory {
  content: string;
  created_at: string;
  username: string;
}

interface MessageSender {
  user_id: string;
  username: string;
  avatar_url: string | null;
  full_name: string;
}

export function AvatarChat({ className = '' }: AvatarChatProps) {
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);
  const [streamedResponse, setStreamedResponse] = useState<string>('');
  const [chatError, setChatError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { createDirectMessage } = useDirectMessages();

  const {
    messages,
    isLoading,
    error: messagesError,
    sendMessage
  } = useRealtimeMessages({
    channelId: targetUser?.channelId || '',
    chatType: 'dm'  // Always use DM mode
  });

  // Fetch user's message history when selected
  const fetchMessageHistory = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('content, inserted_at')
        .eq('user_id', userId)
        .order('inserted_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Convert the data to match MessageHistory interface
      const formattedData: MessageHistory[] = (data || []).map(msg => ({
        content: msg.content,
        created_at: msg.inserted_at,
        username: msg.inserted_at
      }));
      
      setMessageHistory(formattedData);
    } catch (err) {
      console.error('Failed to fetch message history:', err);
      setMessageHistory([]);
    }
  }, []);

  const handleUserSelect = useCallback(async (user: User) => {
    try {
      setTargetUser(null); // Reset current user first
      setMessageHistory([]); // Reset message history

      // Fetch user's message history
      await fetchMessageHistory(user.id);

      // Create or get existing DM channel
      const channelId = await createDirectMessage(user.username);

      // Wait for channel to be fully created and members added
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update target user with channel ID
      setTargetUser({ ...user, channelId });
      setMessageId(null); // Reset message context
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create direct message');
    }
  }, [createDirectMessage, fetchMessageHistory]);

  const formatMessageHistory = useCallback((messages: MessageHistory[]) => {
    return messages.map(msg => ({
      content: msg.content,
      created_at: msg.created_at,
      username: msg.username
    }));
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!targetUser) {
      alert('Please select a target user first');
      return;
    }

    try {
      // First send the message using the common functionality
      const messageResult = await sendMessage(content);
      console.log('User message sent successfully');

      // Get current session for avatar API request
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Error getting session:', sessionError)
        throw new Error('No active session')
      }

      if (!session?.access_token) {
        throw new Error('No active session or missing access token')
      }

      // Log token details for debugging
      console.log('Making avatar API request:', {
        tokenLength: session.access_token.length,
        tokenPrefix: session.access_token.substring(0, 10) + '...',
        username: targetUser.username,
        historyLength: messageHistory.length
      })

      // Make API request to avatar service
      const response = await fetch(isStreaming ? 'http://localhost:8000/api/chat/stream' : 'http://localhost:8000/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          content,
          target_user_id: targetUser.id,
          mode: 'direct'
        })
      });

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Avatar API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          headers: Object.fromEntries(response.headers.entries())
        })
        throw new Error(`Avatar API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      console.log('Avatar API response received:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      })

      if (isStreaming) {
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Failed to get response reader')
        }

        let streamedContent = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          console.log('Received stream chunk:', text)
          streamedContent += text
          // Update UI with streamed content
          setStreamedResponse(streamedContent)
        }

        console.log('Stream complete, sending avatar response')
        // Send the avatar's response
        await sendMessage(streamedContent)
      } else {
        const data = await response.json()
        console.log('Received avatar response:', data)
        
        // Send the avatar's response
        await sendMessage(data.content)
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error)
      setChatError(error instanceof Error ? error.message : 'An error occurred')
      // Display error in UI
      alert(error instanceof Error ? error.message : 'An error occurred while sending the message')
    }
  }, [targetUser, sendMessage, messageId, isStreaming, messageHistory]);

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
              activeUserId={targetUser?.id}
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
                <p>History: {messageHistory.length} messages</p>
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
                onSendMessage={handleSendMessage}
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