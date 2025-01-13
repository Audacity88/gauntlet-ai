import { useCallback, useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { Message } from '../types/schema';
import { MessageWithUser } from '../types/models';
import { AnyMessage, getMessageProcessor, MessageType } from '../utils/MessageProcessor';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
        setError(fetchError);
        return;
      }

      const newMessages = data as MessageWithUser[];
      
      if (newMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }

      if (newMessages.length > 0) {
        lastMessageTimestamp.current = chatType === 'dm' 
          ? newMessages[0].created_at || null
          : newMessages[0].inserted_at || null;
      }

      // Only update messages if we're still on the same channel
      if (lastChannelId.current === channelId && lastChatType.current === chatType) {
        setMessages(prev => 
          olderThan 
            ? [...newMessages, ...prev]
            : newMessages
        );
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setIsLoading(false);
    }
  }, [channelId, chatType, searchQuery, user, parentId]);

  // Separate effect to handle initial message loading
  useEffect(() => {
    if (user && channelId && !messages.length) {
      fetchMessages();
    }
  }, [user, channelId, messages.length, fetchMessages]);

  // Handle member data fetching
  useEffect(() => {
    const fetchMemberData = async () => {
      if (!user || !channelId) {
        setIsMembershipLoading(false);
        return;
      }
      
      try {
        const table = chatType === 'dm' ? 'direct_message_members' : 'channel_members';
        const { data, error: memberError } = await supabase
          .from(table)
          .select('profile_id')
          .eq('channel_id', channelId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberError) {
          setError(memberError instanceof Error ? memberError : new Error('Failed to fetch member data'));
          return;
        }

        // Only update member data if we're still on the same channel and user
        if (lastChannelId.current === channelId && lastChatType.current === chatType) {
          if (data) {
            setMemberData(data);
            setError(null);
          } else {
            setError(new Error(`Not a member of this ${chatType === 'dm' ? 'conversation' : 'channel'}`));
          }
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

  useEffect(() => {
    if (!user || !channelId || !memberData) return;

    const table = chatType === 'dm' ? 'direct_messages' : 'messages';
    
    console.log('Setting up real-time subscription:', {
      table,
      channelId,
      parentId,
      chatType
    });

    const channel = supabase
      .channel(`${table}:${channelId}:${parentId || 'main'}`)
      .on<PostgresChanges>(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: PostgresChanges) => {
          console.log('Received real-time event:', {
            eventType: payload.eventType,
            parentId: payload.new?.parent_id,
            messageId: payload.new?.id,
            chatType
          });

          if (payload.eventType === 'INSERT') {
            const messageParentId = payload.new.parent_id;
            const belongsInView = parentId 
              ? messageParentId === parentId  // In thread view, show messages with matching parent_id
              : !messageParentId;             // In main view, show messages without parent_id

            console.log('Message belongs in view:', {
              belongsInView,
              messageParentId,
              viewParentId: parentId,
              chatType
            });

            if (!belongsInView) return;

            const { data: newMessageData, error: fetchError } = await supabase
              .from(table)
              .select(chatType === 'dm' ? '*, user:profiles(*), attachments' : '*, profile:profiles(*), attachments')
              .eq('id', payload.new.id)
              .single();

            if (fetchError) {
              console.error('Error fetching new message:', fetchError);
              return;
            }

            if (!newMessageData) {
              console.error('No message data returned');
              return;
            }

            console.log('Adding new message to state:', newMessageData);

            setMessages(prev => {
              // Check if message already exists
              const messageExists = prev.some(msg => msg.id === newMessageData.id);
              if (messageExists) {
                console.log('Message already exists in state');
                return prev;
              }

              // Double check parent_id matches current view context
              const newMessageParentId = newMessageData.parent_id;
              const shouldShow = parentId 
                ? newMessageParentId === parentId
                : !newMessageParentId;

              if (!shouldShow) {
                console.log('Message parent_id does not match view context');
                return prev;
              }

              return [...prev, newMessageData as MessageWithUser];
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old as MessageWithUser;
            setMessages(prev => 
              prev.filter(msg => msg.id !== deletedMessage.id)
            );
          } else if (payload.eventType === 'UPDATE') {
            const messageParentId = payload.new.parent_id;
            const belongsInView = parentId 
              ? messageParentId === parentId
              : !messageParentId;

            // If message was moved to a different thread, remove it from current view
            if (!belongsInView) {
              setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
              return;
            }

            const { data: updatedMessageData, error: fetchError } = await supabase
              .from(table)
              .select(chatType === 'dm' ? '*, user:profiles(*), attachments' : '*, profile:profiles(*), attachments')
              .eq('id', payload.new.id)
              .single();

            if (fetchError || !updatedMessageData) return;

            // Double check parent_id matches current view context
            const updatedParentId = updatedMessageData.parent_id;
            const shouldShow = parentId 
              ? updatedParentId === parentId
              : !updatedParentId;

            if (!shouldShow) {
              setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
              return;
            }

            setMessages(prev =>
              prev.map(msg =>
                msg.id === updatedMessageData.id ? updatedMessageData as MessageWithUser : msg
              )
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status, err || 'No error');
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('Cleaning up subscription:', {
        channelId,
        parentId,
        chatType
      });
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [channelId, chatType, user, memberData, parentId]);

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

      if (chatType === 'dm') {
        const messageData = {
            channel_id: channelId,
            user_id: user.id,
          profile_id: memberData.profile_id,
            content: trimmedContent || ' ',
          parent_id: effectiveParentId,
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
              : undefined
        };

        const { data, error } = await supabase
          .from('direct_messages')
          .insert(messageData)
          .select('*, user:profiles(*)')
          .single();

        if (error) throw error;
        return data;
      } else {
        const messageData = {
            channel_id: channelId,
            user_id: user.id,
            profile_id: memberData.profile_id,
          parent_id: effectiveParentId,
            content: trimmedContent || ' ',
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
              : undefined,
            inserted_at: now,
            updated_at: now
        };

        const { data, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select('*, profile:profiles(*)')
          .single();

        if (error) throw error;
        return data;
      }
    },
    [user, channelId, chatType, memberData, isMembershipLoading, parentId]
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
