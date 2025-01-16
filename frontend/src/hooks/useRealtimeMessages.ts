import { useCallback, useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { Message } from '../types/schema';
import { MessageWithUser } from '../types/models';
import { AnyMessage, getMessageProcessor, MessageType } from '../utils/MessageProcessor';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useMessageCache } from './useMessageCache';

const MESSAGES_PER_PAGE = 50;

interface UseRealtimeMessagesProps {
  channelId: string;
  chatType?: MessageType;
  searchQuery?: string;
  parentId?: string;
}

interface PostgresChanges {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
}

export function useRealtimeMessages({
  channelId,
  chatType = 'channel',
  searchQuery,
  parentId
}: UseRealtimeMessagesProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [memberData, setMemberData] = useState<{ profile_id: string } | null>(null);
  const [isMembershipLoading, setIsMembershipLoading] = useState(false);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const lastMessageTimestamp = useRef<string | null>(null);
  const lastChannelId = useRef<string | null>(null);
  const lastChatType = useRef<MessageType | null>(null);
  const { handleRealtimeUpdate } = useMessageCache();

  // Helper function to get message timestamp
  const getMessageTimestamp = useCallback((message: MessageWithUser): string => {
    if (!message) {
      console.warn('Trying to get timestamp of undefined message');
      return new Date().toISOString();
    }

    // For DMs, use created_at
    if (chatType === 'dm') {
      if (message.created_at) {
        return message.created_at;
      }
      console.warn('DM missing created_at timestamp:', message.id);
    } else {
      // For channel messages, prefer inserted_at
      if (message.inserted_at) {
        return message.inserted_at;
      }
      console.warn('Channel message missing inserted_at timestamp:', message.id);
    }
    
    // Fallback chain for channel messages
    if (message.created_at) return message.created_at;
    if (message.updated_at) return message.updated_at;
    
    console.warn('No valid timestamp found for message:', message.id);
    return new Date().toISOString();
  }, [chatType]);

  // Helper function to sort messages
  const sortMessages = useCallback((messages: MessageWithUser[]): MessageWithUser[] => {
    return [...messages].sort((a, b) => {
      const aTime = getMessageTimestamp(a);
      const bTime = getMessageTimestamp(b);
      
      // Validate timestamp strings
      if (!aTime || typeof aTime !== 'string') {
        console.error('Invalid timestamp format for message:', a.id);
        return 1;
      }
      
      if (!bTime || typeof bTime !== 'string') {
        console.error('Invalid timestamp format for message:', b.id);
        return -1;
      }

      // Try to parse the ISO strings
      let aDate: Date, bDate: Date;
      try {
        aDate = new Date(aTime);
        bDate = new Date(bTime);
      } catch (error) {
        console.error('Error parsing dates for messages:', a.id, b.id);
        return 0;
      }
      
      if (isNaN(aDate.getTime())) {
        console.error('Invalid date for message:', a.id);
        return 1;
      }
      if (isNaN(bDate.getTime())) {
        console.error('Invalid date for message:', b.id);
        return -1;
      }
      
      return aDate.getTime() - bDate.getTime();
    });
  }, [getMessageTimestamp]);

  // Update message state with proper sorting
  const updateMessages = useCallback((newMessage: MessageWithUser, currentMessages: MessageWithUser[]) => {
    // Check if message already exists
    if (currentMessages.some(msg => msg.id === newMessage.id)) {
      return currentMessages;
    }
    return sortMessages([...currentMessages, newMessage]);
  }, [sortMessages]);

  // Reset states when channel changes
  useEffect(() => {
    const isNewChannel = lastChannelId.current !== channelId;
    const isNewChatType = lastChatType.current !== chatType;
    const isInitialLoad = !lastChannelId.current && !lastChatType.current;
    
    // Always update refs for tracking
    lastChannelId.current = channelId;
    lastChatType.current = chatType;
    
    // Skip any resets if we're just opening the messages tab
    // Only reset states when actively switching between channels
    if (!isInitialLoad && channelId && lastChannelId.current) {
      // Only reset states if we have a real channel change within the same chat type
      if (isNewChannel && !isNewChatType) {
        lastMessageTimestamp.current = null;
        setHasMore(true);
        setMessages([]);
        setMemberData(null);
        setIsMembershipLoading(true);
      }
      
      // If chat type changes, only reset pagination
      if (isNewChatType) {
        lastMessageTimestamp.current = null;
        setHasMore(true);
      }
    }
  }, [channelId, chatType]);

  // Add new effect to handle thread changes
  useEffect(() => {
    // Reset messages when switching threads
    lastMessageTimestamp.current = null;
    setHasMore(true);
    setMessages([]);
  }, [parentId]);

  const fetchMessages = useCallback(async (olderThan: string | null = null) => {
    if (!user || !channelId) return;

    try {
      setIsLoading(true);
      
      const timestampField = chatType === 'dm' ? 'created_at' : 'inserted_at';
      
      console.log('Fetching messages:', {
        channelId,
        chatType,
        timestampField,
        olderThan
      });

      const query = chatType === 'dm'
        ? supabase
            .from('direct_messages')
            .select('*, user:profiles(*), attachments')
            .eq('channel_id', channelId)
        : supabase
            .from('messages')
            .select('*, profile:profiles(*), attachments')
            .eq('channel_id', channelId);

      // Handle thread filtering consistently for both message types
      if (parentId) {
        query.eq('parent_id', parentId);
      } else {
        query.is('parent_id', null);
      }

      if (searchQuery) {
        query.textSearch('content', searchQuery);
      }

      if (olderThan) {
        query.lt(timestampField, olderThan);
      }

      query.order(timestampField, { ascending: true }).limit(MESSAGES_PER_PAGE);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching messages:', fetchError);
        setError(fetchError);
        return;
      }

      const newMessages = data as MessageWithUser[];
      
      console.log('Messages fetched:', {
        count: newMessages.length,
        messages: newMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          timestamps: {
            created_at: msg.created_at,
            inserted_at: msg.inserted_at,
            updated_at: msg.updated_at
          }
        }))
      });

      if (newMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }

      if (newMessages.length > 0) {
        // Use our helper to get the timestamp of the first message
        lastMessageTimestamp.current = getMessageTimestamp(newMessages[0]);
        console.log('Updated last message timestamp:', lastMessageTimestamp.current);
      }

      // Only update messages if we're still on the same channel
      if (lastChannelId.current === channelId && lastChatType.current === chatType) {
        setMessages(prev => {
          const combinedMessages = olderThan 
            ? [...newMessages, ...prev]
            : newMessages;
          return sortMessages(combinedMessages);
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setIsLoading(false);
    }
  }, [channelId, chatType, searchQuery, user, parentId, getMessageTimestamp, sortMessages]);

  // Separate effect to handle initial message loading
  useEffect(() => {
    if (user && channelId && !messages.length) {
      fetchMessages();
    }
  }, [user, channelId, messages.length, fetchMessages]);

  // Debug member data changes
  useEffect(() => {
    console.log('Member data changed:', {
      memberData,
      channelId,
      chatType,
      isMembershipLoading
    });
  }, [memberData, channelId, chatType, isMembershipLoading]);

  // Handle member data fetching
  useEffect(() => {
    const fetchMemberData = async () => {
      if (!user || !channelId) {
        console.log('Skipping member data fetch - no user or channelId');
        setIsMembershipLoading(false);
        return;
      }
      
      console.log('Fetching member data:', {
        user: user.id,
        channelId,
        chatType
      });
      
      try {
        const table = chatType === 'dm' ? 'direct_message_members' : 'channel_members';
        const { data, error: memberError } = await supabase
          .from(table)
          .select('profile_id')
          .eq('channel_id', channelId)
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('Member data fetch result:', { data, error: memberError });

        if (memberError) {
          console.error('Member data fetch error:', memberError);
          setError(memberError instanceof Error ? memberError : new Error('Failed to fetch member data'));
          return;
        }

        // Only update member data if we're still on the same channel and user
        if (lastChannelId.current === channelId && lastChatType.current === chatType) {
          if (data) {
            console.log('Setting member data:', data);
            setMemberData(data);
            setError(null);
          } else if (chatType === 'dm') {
            console.log('Creating DM member data');
            // For DMs, try to create member data if it doesn't exist
            const { data: newMemberData, error: insertError } = await supabase
              .from('direct_message_members')
              .insert({
                channel_id: channelId,
                user_id: user.id,
                profile_id: user.id
              })
              .select('profile_id')
              .single();

            console.log('DM member data creation result:', { newMemberData, error: insertError });

            if (insertError) {
              console.error('Failed to create member data:', insertError);
              setError(new Error('Failed to create member data'));
            } else if (newMemberData) {
              console.log('Setting new member data:', newMemberData);
              setMemberData(newMemberData);
              setError(null);
            }
          } else {
            console.log('Not a member of this channel/conversation');
            setError(new Error(`Not a member of this ${chatType === 'dm' ? 'conversation' : 'channel'}`));
          }
        } else {
          console.log('Channel changed during member data fetch, skipping update');
        }
      } finally {
        setIsMembershipLoading(false);
      }
    };

    if (user && channelId) {
      setIsMembershipLoading(true);
      fetchMemberData();
    }
  }, [user, channelId, chatType]);

  const loadMore = useCallback(async () => {
    if (!lastMessageTimestamp.current || isLoading || !hasMore) return;
    await fetchMessages(lastMessageTimestamp.current);
  }, [fetchMessages, isLoading, hasMore]);

  // Message subscription setup
  useEffect(() => {
    if (!user || !channelId) return;

    const table = chatType === 'dm' ? 'direct_messages' : 'messages';
    const subscriptionId = `realtime:${table}:${channelId}`;
    let isCurrentSubscription = true;

    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`,
          broadcast: { self: true }
        },
        async (payload) => {
          if (!isCurrentSubscription) return;
          
          const messageId = payload.new.id;
          const query = chatType === 'dm'
            ? supabase
              .from('direct_messages')
                .select('*, user:profiles(*), attachments')
                .eq('id', messageId)
            : supabase
              .from('messages')
                .select('*, profile:profiles(*), attachments')
                .eq('id', messageId);

          const { data: messageWithUser, error } = await query.single();

          if (!isCurrentSubscription) return;

          if (error) {
            console.error('Error fetching message details:', error);
            return;
          }

          if (messageWithUser) {
            handleRealtimeUpdate(messageWithUser);
            setMessages(prev => updateMessages(messageWithUser, prev));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`,
          broadcast: { self: true }
        },
        async (payload) => {
          if (!isCurrentSubscription) return;
          
          const messageId = payload.new.id;
          const query = chatType === 'dm'
            ? supabase
                .from('direct_messages')
                .select('*, user:profiles(*), attachments')
                .eq('id', messageId)
            : supabase
                .from('messages')
                .select('*, profile:profiles(*), attachments')
                .eq('id', messageId);

          const { data: messageWithUser, error } = await query.single();

          if (!isCurrentSubscription) return;

          if (error) {
            console.error('Error fetching updated message:', error);
            return;
          }

          if (messageWithUser) {
            handleRealtimeUpdate(messageWithUser);
            setMessages(prev => {
              const existing = prev.findIndex(msg => msg.id === messageWithUser.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = messageWithUser;
                return updated;
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`,
          broadcast: { self: true }
        },
        (payload) => {
          if (!isCurrentSubscription) return;
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe((status, err) => {
        if (!isCurrentSubscription) return;
        if (err) {
          console.error('Message subscription error:', err);
        }
      });

    return () => {
      isCurrentSubscription = false;
      channel.unsubscribe();
    };
  }, [user?.id, channelId, chatType, updateMessages, handleRealtimeUpdate]);

  const sendMessage = useCallback(
    async (
      content: string,
      attachmentUrl?: string,
      fileMetadata?: { filename: string; contentType: string; size: number },
      replyToId?: string
    ) => {
      if (!user) throw new Error('No user found');
      if (!memberData) throw new Error('No member data found');
      if (isMembershipLoading) throw new Error('Membership status is still loading');
      
      const trimmedContent = content.trim();
      const now = new Date().toISOString();

      const effectiveParentId = replyToId || parentId || null;

      try {
        let result;
        if (chatType === 'dm') {
          const messageData = {
            channel_id: channelId,
            user_id: user.id,
            profile_id: memberData.profile_id,
            content: trimmedContent || ' ',
            parent_id: effectiveParentId,
            created_at: now,
            updated_at: now,
            attachments: attachmentUrl
              ? [
                  {
                    url: attachmentUrl,
                    file_path: attachmentUrl,
                    filename:
                      fileMetadata?.filename ||
                      attachmentUrl.split('/').pop() ||
                      'attachment',
                    content_type:
                      fileMetadata?.contentType || 'application/octet-stream',
                    size: fileMetadata?.size || 0
                  }
                ]
              : []
          };

          const { data, error } = await supabase
            .from('direct_messages')
            .insert(messageData)
            .select('*, user:profiles(*)')
            .single();

          if (error) throw error;
          result = data;
        } else {
          const messageData = {
            channel_id: channelId,
            user_id: user.id,
            profile_id: memberData.profile_id,
            content: trimmedContent || ' ',
            parent_id: effectiveParentId,
            inserted_at: now,
            updated_at: now,
            attachments: attachmentUrl
              ? [
                  {
                    url: attachmentUrl,
                    file_path: attachmentUrl,
                    filename:
                      fileMetadata?.filename ||
                      attachmentUrl.split('/').pop() ||
                      'attachment',
                    content_type:
                      fileMetadata?.contentType || 'application/octet-stream',
                    size: fileMetadata?.size || 0
                  }
                ]
              : []
          };

          const { data, error } = await supabase
            .from('messages')
            .insert(messageData)
            .select('*, profile:profiles(*)')
            .single();

          if (error) throw error;
          result = data;
        }

        console.log('Message sent successfully:', {
          messageId: result.id,
          channelId,
          timestamp: now,
          messageTimestamp: getMessageTimestamp(result)
        });

        return result;
      } catch (error) {
        console.error('Failed to send message:', {
          error,
          channelId,
          chatType,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    },
    [user, channelId, chatType, memberData, isMembershipLoading, parentId, getMessageTimestamp]
  );

  return {
    messages,
    isLoading: isLoading || isMembershipLoading,
    error,
    hasMore,
    sendMessage,
    loadMore
  };
}
