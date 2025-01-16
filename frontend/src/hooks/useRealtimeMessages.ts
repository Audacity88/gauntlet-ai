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
    if (!user || !channelId || !memberData) {
      console.log('Skipping message subscription setup:', {
        hasUser: !!user,
        hasChannelId: !!channelId,
        hasMemberData: !!memberData
      });
      return;
    }

    const table = chatType === 'dm' ? 'direct_messages' : 'messages';
    const subscriptionId = `${table}:${channelId}:${parentId || 'main'}`;
    
    console.log('Setting up message subscription:', {
      subscriptionId,
      table,
      channelId,
      parentId,
      chatType
    });

    const channel = supabase
      .channel(subscriptionId)
      .on<PostgresChanges>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: PostgresChanges) => {
          console.log('Message INSERT event received:', payload);
          const newMessage = payload.new;
          
          // For DMs, try to fetch the user data if not included
          if (chatType === 'dm') {
            const { data: messageWithUser, error } = await supabase
              .from('direct_messages')
              .select('*, user:profiles(*)')
              .eq('id', newMessage.id)
              .single();

            console.log('Fetched DM message with user:', { messageWithUser, error });

            if (!error && messageWithUser) {
              setMessages(prev => {
                if (prev.some(msg => msg.id === messageWithUser.id)) {
                  console.log('Message already exists, skipping');
                  return prev;
                }
                console.log('Adding new DM message');
                const allMessages = [...prev, messageWithUser];
                return allMessages.sort((a, b) => 
                  new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
                );
              });
            }
          } else {
            // For regular channels
            const { data: messageWithProfile, error } = await supabase
              .from('messages')
              .select('*, profile:profiles(*)')
              .eq('id', newMessage.id)
              .single();

            console.log('Fetched channel message with profile:', { messageWithProfile, error });

            if (!error && messageWithProfile) {
              setMessages(prev => {
                if (prev.some(msg => msg.id === messageWithProfile.id)) {
                  console.log('Message already exists, skipping');
                  return prev;
                }
                console.log('Adding new channel message');
                const allMessages = [...prev, messageWithProfile];
                return allMessages.sort((a, b) => 
                  new Date(a.inserted_at || '').getTime() - new Date(b.inserted_at || '').getTime()
                );
              });
            }
          }
        }
      )
      .on<PostgresChanges>(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        (payload: PostgresChanges) => {
          const deletedMessage = payload.old as MessageWithUser;
          setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
        }
      )
      .on<PostgresChanges>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: PostgresChanges) => {
          const updatedMessage = payload.new;
          const { data: messageWithUser, error } = await supabase
            .from(table)
            .select(chatType === 'dm' ? '*, user:profiles(*)' : '*, profile:profiles(*)')
            .eq('id', updatedMessage.id)
            .single();

          if (!error && messageWithUser) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === messageWithUser.id ? messageWithUser : msg
              )
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Message subscription status:', status, err || 'No error');
        if (err) {
          console.error('Message subscription error:', err);
        }
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('Cleaning up message subscription:', subscriptionId);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, channelId, chatType, memberData, parentId]);

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
