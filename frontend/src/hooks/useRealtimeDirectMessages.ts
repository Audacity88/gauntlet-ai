import { useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useDirectMessageStore } from '../stores/directMessageStore';
import { useAuth } from './useAuth';
import { DirectMessage } from '../types/schema';
import { getDirectMessageProcessor, DirectMessageWithDetails } from '../utils/DirectMessageProcessor';
import { useUserStore } from '../stores/userStore';

interface UseRealtimeDirectMessagesProps {
  userId?: string;
}

export function useRealtimeDirectMessages({ userId }: UseRealtimeDirectMessagesProps = {}) {
  const { user } = useAuth();
  const {
    conversations,
    optimisticMessages,
    addMessage,
    updateMessage,
    removeMessage,
    setConversationMessages,
    setLoading,
    setError
  } = useDirectMessageStore();

  const { users } = useUserStore();

  // Create message processor
  const messageProcessor = useMemo(() => {
    if (!user) return null;
    return getDirectMessageProcessor({
      getUserById: (id: string) => users.get(id),
      currentUserId: user.id
    });
  }, [users, user]);

  // Process and add new message
  const processMessage = useCallback((newMessage: DirectMessage) => {
    if (!messageProcessor) return;
    const processed = messageProcessor.processDirectMessage(newMessage);
    if (processed) {
      addMessage(processed);
    }
  }, [messageProcessor, addMessage]);

  // Load initial messages
  useEffect(() => {
    if (!user || !userId || !messageProcessor) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data, error: queryError } = await supabase
          .from('direct_messages')
          .select(`
            *,
            sender:profiles!direct_messages_sender_id_fkey(*),
            receiver:profiles!direct_messages_receiver_id_fkey(*)
          `)
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: true });

        if (queryError) throw queryError;

        if (data) {
          const processed = messageProcessor.processDirectMessages(data);
          setConversationMessages(userId, processed);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load messages');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [user, userId, messageProcessor, setConversationMessages, setLoading, setError]);

  // Subscribe to message changes
  useEffect(() => {
    if (!user || !messageProcessor) return;

    // Clear processed messages when subscribing
    messageProcessor.clearProcessedIds();

    const channel = supabase
      .channel('direct_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: userId 
            ? `or(sender_id.eq.${userId},receiver_id.eq.${userId})`
            : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && !messageProcessor.hasProcessed(payload.new.id)) {
            processMessage(payload.new as DirectMessage);
          } else if (payload.eventType === 'UPDATE') {
            const processed = messageProcessor.processDirectMessage({
              ...payload.new as DirectMessage,
              eventType: 'UPDATE'
            });
            if (processed) {
              updateMessage(processed.id, processed);
            }
          } else if (payload.eventType === 'DELETE') {
            removeMessage(payload.old.id);
          }
        }
      )
      .subscribe();

    return () => {
      messageProcessor.clearProcessedIds();
      supabase.removeChannel(channel);
    };
  }, [user, userId, messageProcessor, processMessage, updateMessage, removeMessage]);

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

    const optimisticId = `temp-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const optimisticMessage: DirectMessageWithDetails = {
      id: optimisticId,
      sender_id: user.id,
      receiver_id: userId,
      content,
      created_at: timestamp,
      updated_at: timestamp,
      sender: user,
      receiver: users.get(userId)
    };

    // Add optimistic message
    addMessage(optimisticMessage);

    try {
      const { data: newMessage, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          content
        })
        .select(`
          *,
          sender:profiles!direct_messages_sender_id_fkey(*),
          receiver:profiles!direct_messages_receiver_id_fkey(*)
        `)
        .single();

      if (error) throw error;

      // Process and add the real message
      if (newMessage) {
        const processed = messageProcessor.processDirectMessage(newMessage);
        if (processed) {
          addMessage(processed);
        }
      }

      return newMessage;
    } catch (err) {
      // Remove optimistic message on error
      removeMessage(optimisticId);
      throw err;
    }
  }, [user, userId, messageProcessor, users, addMessage, removeMessage]);

  return {
    messages,
    sendMessage
  };
} 