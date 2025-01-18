import { useState, useCallback, useEffect } from 'react';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { MessageList } from './MessageList';
import { UserList } from './UserList';
import { User } from '../types/models';
import { useAuth } from '../hooks/useAuth';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { supabase } from '../lib/supabaseClient';
import { MessageWithUser } from '../types/models';

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

interface MessageDBResponse {
  content: string;
  inserted_at: string;
  profiles: {
    username: string;
  }[];
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  metadata?: {
    is_avatar_response?: boolean;
    is_introduction?: boolean;
  };
}

interface UseRealtimeMessagesResult {
  messages: MessageWithUser[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (message: string) => Promise<void>;
}

export function AvatarChat({ className = '' }: AvatarChatProps) {
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const { createDirectMessage } = useDirectMessages();

  const {
    messages,
    isLoading: messagesIsLoading,
    error: messagesError,
    sendMessage
  }: UseRealtimeMessagesResult = useRealtimeMessages({
    channelId: targetUser?.channelId || '',
    chatType: 'dm'  // Always use DM mode
  });

  // No need to track latest summary since we're showing all messages
  const displayMessages = messages;

  // Debug logging for message display
  useEffect(() => {
    if (messages?.length) {
      console.log('Message display debug:', {
        totalMessages: messages.length,
        displayedMessages: displayMessages?.length,
        firstMessage: messages[0] ? {
          id: messages[0].id,
          content: messages[0].content?.substring(0, 50),
          created_at: messages[0].created_at
        } : null,
        lastMessage: messages[messages.length - 1] ? {
          id: messages[messages.length - 1].id,
          content: messages[messages.length - 1].content?.substring(0, 50),
          created_at: messages[messages.length - 1].created_at
        } : null,
        allMessageIds: messages.map((m: Message) => ({
          id: m.id,
          content: m.content?.substring(0, 50),
          created_at: m.created_at,
          is_avatar_response: m.metadata?.is_avatar_response,
          is_introduction: m.metadata?.is_introduction
        }))
      });
    }
  }, [messages, displayMessages]);

  // Fetch user's message history when selected
  const fetchMessageHistory = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('content, inserted_at, profiles(username)')
        .eq('user_id', userId)
        .order('inserted_at', { ascending: false })
        // .limit(50);

      if (error) throw error;
      
      // Convert the data to match MessageHistory interface
      const formattedData: MessageHistory[] = ((data || []) as MessageDBResponse[]).map(msg => ({
        content: msg.content,
        created_at: msg.inserted_at,
        username: msg.profiles[0]?.username || 'unknown'
      }));
      
      setMessageHistory(formattedData);
    } catch (err) {
      console.error('Failed to fetch message history:', err);
      setMessageHistory([]);
    }
  }, []);

  const handleUserSelect = useCallback(async (user: User) => {
    try {
      setIsLoading(true);
      setTargetUser(null); // Reset current user first
      setMessageHistory([]); // Reset message history
      setChatError(null);

      // Fetch the user's public message history
      await fetchMessageHistory(user.id);

      // Create or get existing DM channel
      const channelId = await createDirectMessage(user.username);

      // Get current session for API request
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('No active session or missing access token');
      }

      // Debug token format
      console.log('Token debug:', {
        tokenLength: session.access_token.length,
        tokenParts: session.access_token.split('.').length,
        tokenStart: session.access_token.substring(0, 20) + '...',
      });

      // Check if there's already an introduction message for this user
      const { data: existingMessages, error: messagesError } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('channel_id', channelId)
        .eq('metadata->is_avatar_response', true)
        .eq('metadata->is_introduction', true)
        .is('deleted_at', null)  // Only consider non-deleted messages
        .order('created_at', { ascending: false })
        .limit(1);

      if (messagesError) {
        console.error('Error checking for existing introduction:', messagesError);
      }

      // Only make the API call if there's no existing introduction
      if (!existingMessages?.length) {
        console.log('No existing introduction found, requesting user summary...');
        
        // Get messages from the public messages table
        const { data: publicMessages, error: publicMessagesError } = await supabase
          .from('messages')
          .select('content, inserted_at, id')
          .eq('user_id', user.id)
          .order('inserted_at', { ascending: false })
          .limit(50);

        if (publicMessagesError) {
          console.error('Error fetching public messages:', publicMessagesError);
          throw publicMessagesError;
        }

        // Format messages for the API
        const formattedMessages = (publicMessages || []).map(msg => ({
          content: msg.content,
          metadata: {
            username: user.username,
            timestamp: msg.inserted_at,
            channel: 'channel',
            message_id: msg.id
          }
        }));
        
        // Make API request to get user summary
        const requestBody = {
          target_user_id: user.id,
          mode: 'direct',
          message_history: formattedMessages
        };
        console.log('Sending user summary request:', requestBody);
        
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/api/chat/user_summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error getting user summary:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            requestBody
          });
          throw new Error(errorText);
        }
      } else {
        console.log('Found existing introduction, skipping user summary request');
      }

      // Wait for channel to be fully created and members added
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update target user with channel ID
      setTargetUser({ ...user, channelId });
      setMessageId(null); // Reset message context
    } catch (err) {
      console.error('Error in handleUserSelect:', err);
      setChatError(err instanceof Error ? err.message : 'Failed to create direct message');
    } finally {
      setIsLoading(false);
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
      // Get current session for avatar API request
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Error getting session:', sessionError)
        throw new Error('No active session')
      }

      if (!session?.access_token) {
        throw new Error('No active session or missing access token')
      }

      // Debug token format
      console.log('Send message token debug:', {
        tokenLength: session.access_token.length,
        tokenParts: session.access_token.split('.').length,
        tokenStart: session.access_token.substring(0, 20) + '...',
      });

      // Log token details for debugging
      console.log('Making avatar API request:', {
        tokenLength: session.access_token.length,
        tokenPrefix: session.access_token.substring(0, 10) + '...',
        username: targetUser.username,
        historyLength: messageHistory.length
      })

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      // Make API request to get avatar's response - this will also create the user's message
      const response = await fetch(`${API_BASE_URL}/api/chat/send`, {
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

      const data = await response.json()
      console.log('Received avatar response:', data)
      
      // The avatar API will handle creating the response message in the database
      // No need to call sendMessage again
    } catch (error) {
      console.error('Error in handleSendMessage:', error)
      setChatError(error instanceof Error ? error.message : 'An error occurred')
      // Display error in UI
      alert(error instanceof Error ? error.message : 'An error occurred while sending the message')
    }
  }, [targetUser, sendMessage, messageId, messageHistory]);

  const handleClearContext = useCallback(async () => {
    if (!targetUser?.channelId) {
      alert('Please select a target user first');
      return;
    }

    try {
      console.log('Clearing messages for channel:', targetUser.channelId);

      // First delete current user's messages
      const { data: messages, error: fetchError } = await supabase
        .from('direct_messages')
        .select('id')
        .eq('channel_id', targetUser.channelId)
        .is('deleted_at', null);

      if (fetchError) {
        console.error('Error fetching messages:', fetchError);
        throw fetchError;
      }

      console.log('Found messages to delete:', messages?.length);

      // Delete current user's messages
      const now = new Date().toISOString();
      for (const message of messages || []) {
        const { error: deleteError } = await supabase
          .from('direct_messages')
          .update({ deleted_at: now })
          .eq('id', message.id);

        if (deleteError) {
          console.error('Error deleting message:', message.id, deleteError);
          throw deleteError;
        }
      }

      // Now handle test user's messages through the API
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('No active session or missing access token');
      }

      // Call the API to clear test user's messages
      const response = await fetch('${API_BASE_URL}/api/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          channel_id: targetUser.channelId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('Successfully cleared all messages');

      // Reset state
      setMessageId(null);
      setMessageHistory([]);
      setChatError(null);

      // Force a complete reload of the chat
      // First unsubscribe from the current channel
      if (targetUser.channelId) {
        const channel = supabase.channel(targetUser.channelId);
        await channel.unsubscribe();
      }

      // Trigger a re-selection of the user to fully reset the chat
      await handleUserSelect(targetUser);

    } catch (error) {
      console.error('Error clearing context:', error);
      alert(error instanceof Error ? error.message : 'Failed to clear context');
    }
  }, [targetUser, handleUserSelect]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r flex flex-col overflow-hidden">
        {/* Scrollable user list section */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-none hover:scrollbar-thin scrollbar-track-transparent scrollbar-thumb-indigo-600/40 hover:scrollbar-thumb-indigo-600/60 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:min-h-[40px]">
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
            <button
              onClick={handleClearContext}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Clear Context
            </button>

            <div className="p-4 bg-white rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Current State</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Target: {targetUser?.username || 'Not set'}</p>
                <p>Message ID: {messageId || 'None'}</p>
                <p>History: {messageHistory.length} messages</p>
                <p>AI Messages: {messages?.length || 0} total</p>
                {isLoading && <p className="text-indigo-600">Loading user summary...</p>}
                {chatError && <p className="text-red-500">Error: {chatError}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Loading user summary...
          </div>
        ) : targetUser ? (
          <MessageList
            channelId={targetUser.channelId}
            chatType="dm"
            chatName={targetUser.username}
            onSendMessage={handleSendMessage}
            messages={displayMessages}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a target user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}