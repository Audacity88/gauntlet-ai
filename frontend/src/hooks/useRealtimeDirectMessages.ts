import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDirectMessageStore } from '../stores/directMessageStore';
import { useMessageProcessor } from './useMessageProcessor';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabaseClient';
import { DirectMessage } from '../types/schema';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface UseRealtimeDirectMessagesProps {
  userId?: string;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export function useRealtimeDirectMessages({ userId }: UseRealtimeDirectMessagesProps = {}) {
  const { user } = useAuth();
  const messageProcessor = useMessageProcessor();
  const [channelId, setChannelId] = useState<string | null>(null);
  
  const {
    conversations,
    optimisticMessages,
    addMessage,
    updateMessage,
    removeMessage,
    setConversationMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
    setLoading,
    setError,
  } = useDirectMessageStore();

  // Load initial messages
  useEffect(() => {
    if (!user || !userId || !messageProcessor) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        // First get or create the channel with retry
        const { data: channelData, error: channelError } = await retryOperation(async () => 
          supabase.rpc('find_or_create_dm_channel', {
            p_user_id: user.id,
            p_other_user_id: userId
          })
        );

        if (channelError) throw channelError;

        const newChannelId = channelData.channel_id;
        setChannelId(newChannelId);

        // Then load messages for this channel with retry
        const { data, error: queryError } = await retryOperation(async () =>
          supabase
            .from('direct_messages')
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey(*),
              receiver:profiles!direct_messages_receiver_id_fkey(*)
            `)
            .eq('channel_id', newChannelId)
            .order('created_at', { ascending: true })
        );

        if (queryError) throw queryError;

        if (data) {
          const processed = messageProcessor.processDirectMessages(data);
          setConversationMessages(userId, processed, user.id);
        } else {
          setConversationMessages(userId, [], user.id);
        }
      } catch (err) {
        console.error('Error loading messages:', err);
        const error = err instanceof Error ? err : new Error('Failed to load messages');
        setError(error);
        // Retry the entire operation after a delay
        setTimeout(loadMessages, RETRY_DELAY);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [user, userId, messageProcessor, setConversationMessages, setLoading, setError]);

  // Subscribe to message changes
  useEffect(() => {
    if (!user || !userId || !messageProcessor || !channelId) return;

    let retryCount = 0;
    const setupSubscription = () => {
      const channel = supabase
        .channel(`direct_messages:${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
            filter: `channel_id=eq.${channelId}`
          },
          async (payload) => {
            try {
              if (payload.eventType === 'INSERT') {
                const message = payload.new as DirectMessage;
                const { data, error } = await retryOperation(async () =>
                  supabase
                    .from('direct_messages')
                    .select(`
                      *,
                      sender:profiles!direct_messages_sender_id_fkey(*),
                      receiver:profiles!direct_messages_receiver_id_fkey(*)
                    `)
                    .eq('id', message.id)
                    .single()
                );

                if (!error && data) {
                  const processed = messageProcessor.processDirectMessages([data])[0];
                  addMessage(processed, user.id);
                  removeOptimisticMessage(processed.id);
                }
              }
              // Handle other event types...
            } catch (err) {
              console.error('Error processing message:', err);
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(setupSubscription, RETRY_DELAY * retryCount);
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error('Subscription error:', err);
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              setTimeout(setupSubscription, RETRY_DELAY * retryCount);
            }
          } else {
            retryCount = 0; // Reset retry count on successful subscription
          }
        });

      return channel;
    };

    const channel = setupSubscription();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userId, messageProcessor, channelId, addMessage, removeOptimisticMessage]);

  // Memoize messages array from store
  const messages = useMemo(() => {
    if (!userId) return [];
    const conversationMessages = conversations.get(userId) || [];
    const optimistic = Array.from(optimisticMessages.values())
      .filter(m => m.sender_id === userId || m.receiver_id === userId);
    
    return [...conversationMessages, ...optimistic].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [userId, conversations, optimisticMessages]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !userId || !messageProcessor) {
      throw new Error('Cannot send message: missing user or recipient');
    }

    try {
      // Get the channel ID for these users
      const { data: channelData, error: channelError } = await retryOperation(async () =>
        supabase.rpc('find_or_create_dm_channel', {
          p_user_id: user.id,
          p_other_user_id: userId
        })
      );

      if (channelError) {
        throw new Error('Failed to get or create DM channel');
      }

      const channelId = channelData.channel_id;
      const optimisticId = `temp-${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Get receiver profile
      const { data: receiver, error: receiverError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (receiverError) {
        throw new Error('Failed to get receiver profile');
      }

      const optimisticMessage: DirectMessageWithDetails = {
        id: optimisticId,
        channel_id: channelId,
        sender_id: user.id,
        receiver_id: userId,
        content,
        created_at: timestamp,
        updated_at: timestamp,
        sender: {
          id: user.id,
          username: user.user_metadata?.username || 'Unknown',
          full_name: user.user_metadata?.full_name || 'Unknown',
          avatar_url: user.user_metadata?.avatar_url
        },
        receiver: receiver
      };

      // Add optimistic message
      addOptimisticMessage(optimisticMessage);

      try {
        const { data: newMessage, error } = await retryOperation(async () =>
          supabase
            .from('direct_messages')
            .insert({
              channel_id: channelId,
              sender_id: user.id,
              receiver_id: userId,
              content
            })
            .select(`
              *,
              sender:profiles!direct_messages_sender_id_fkey(*),
              receiver:profiles!direct_messages_receiver_id_fkey(*)
            `)
            .single()
        );

        if (error) throw error;

        if (newMessage) {
          const processed = messageProcessor.processDirectMessages([newMessage])[0];
          addMessage(processed, user.id);
          removeOptimisticMessage(optimisticId);
        }
      } catch (err) {
        // Remove optimistic message on error
        removeOptimisticMessage(optimisticId);
        throw err;
      }
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [user, userId, messageProcessor, addMessage, addOptimisticMessage, removeOptimisticMessage]);

  return {
    messages,
    sendMessage,
    loading,
    error
  };
} 
} 