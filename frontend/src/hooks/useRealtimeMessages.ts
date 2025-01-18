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
            .is('deleted_at', null)
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
            updated_at: msg.updated_at,
            deleted_at: msg.deleted_at
          }
        }))
      });

      if (newMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }

      if (newMessages.length > 0) {
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
  // useEffect(() => {
  //   console.log('Member data changed:', {
  //     memberData,
  //     channelId,
  //     chatType,
  //     isMembershipLoading
  //   });
  // }, [memberData, channelId, chatType, isMembershipLoading]);

  // Handle member data fetching
  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        if (!channelId || !user) {
          setMemberData(null);
          setIsMembershipLoading(false);
          return;
        }

        if (chatType === 'dm') {
          // For DMs, get the member data from direct_message_members
          const { data, error } = await supabase
            .from('direct_message_members')
            .select('id, profile_id')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .single();

          if (error) {
            console.error('Error fetching DM member data:', error);
            setError(error);
            return;
          }
          setMemberData(data);
        } else {
          // For channels, get the member data from channel_members
          const { data, error } = await supabase
            .from('channel_members')
            .select('id, profile_id')
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .single();

          if (error) {
            console.error('Error fetching channel member data:', error);
            setError(error);
            return;
          }
          setMemberData(data);
        }
      } catch (err) {
        console.error('Error fetching member data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch member data'));
      } finally {
        setIsMembershipLoading(false);
      }
    };

    if (channelId && user) {
      setIsMembershipLoading(true);
      fetchMemberData();
    } else {
      setMemberData(null);
      setIsMembershipLoading(false);
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

    // Clean up any existing subscription
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription:', subscriptionId);
      subscriptionRef.current.unsubscribe();
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    // Clean up all other channels before creating a new one
    console.log('Cleaning up all existing channels...');
    supabase.getChannels().forEach(ch => {
      if (ch.topic !== subscriptionId) {
        console.log('Removing channel:', ch.topic);
        supabase.removeChannel(ch);
      }
    });

    console.log('Setting up realtime subscription:', {
      table,
      channelId,
      subscriptionId,
      chatType,
      existingChannels: supabase.getChannels().length
    });

    let retryCount = 0;
    const maxRetries = 3;
    const setupChannel = () => {
      if (!isCurrentSubscription) return;

    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          if (!isCurrentSubscription) {
            console.log('Ignoring event for old subscription');
            return;
          }

          try {
            const { eventType } = payload;
            console.log('Received realtime event:', { 
              eventType, 
              payload,
              channelId,
              messageId: payload.new?.id,
              content: payload.new?.content,
              timestamp: new Date().toISOString()
            });

            // Handle message deletion
            if (eventType === 'DELETE') {
              console.log('Processing DELETE event for message:', payload.old.id);
              setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
              return;
            }

            // Skip if message was soft deleted
            if (eventType === 'UPDATE' && payload.new?.deleted_at) {
              console.log('Processing soft DELETE for message:', payload.new.id);
              setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
              return;
            }

            // For INSERT and UPDATE, fetch the full message data
            const messageId = payload.new.id;
            console.log('Fetching full message data for:', messageId);
            
            const query = chatType === 'dm'
              ? supabase
                  .from('direct_messages')
                  .select(`
                    *,
                    profile:profiles!direct_messages_profile_id_fkey(
                      id,
                      username,
                      full_name,
                      avatar_url
                    )
                  `)
                  .eq('id', messageId)
                  .is('deleted_at', null)
                  .single()
              : supabase
                  .from('messages')
                  .select(`
                    *,
                    profile:profiles(*)
                  `)
                  .eq('id', messageId)
                  .single();

            const { data: messageWithUser, error } = await query;

            if (error) {
              console.error('Error fetching message details:', error);
              return;
            }

            if (messageWithUser) {
              console.log('Successfully fetched message details:', {
                messageId: messageWithUser.id,
                content: messageWithUser.content,
                profile: messageWithUser.profile
              });

              // For channel messages, ensure profile is mapped to user
              const processedMessage = chatType === 'dm' 
                ? messageWithUser 
                : {
                    ...messageWithUser,
                    user: messageWithUser.profile
                  };

              console.log('Processed message for update:', {
                id: processedMessage.id,
                content: processedMessage.content,
                user: processedMessage.user || processedMessage.profile
              });

              if (eventType === 'INSERT') {
                setMessages(prev => {
                  // Avoid duplicate messages
                  if (prev.some(msg => msg.id === processedMessage.id)) {
                    console.log('Skipping duplicate message:', processedMessage.id);
                    return prev;
                  }
                  const updated = updateMessages(processedMessage, prev);
                  console.log('Updated messages after INSERT:', {
                    previousCount: prev.length,
                    newCount: updated.length,
                    messageId: processedMessage.id,
                    lastMessage: updated[updated.length - 1],
                    allMessageIds: updated.map(m => m.id),
                    messageTimestamps: updated.map(m => ({
                      id: m.id,
                      created_at: m.created_at,
                      inserted_at: m.inserted_at
                    }))
                  });
                  return updated;
                });
              } else if (eventType === 'UPDATE') {
                setMessages(prev => {
                  const existing = prev.findIndex(msg => msg.id === processedMessage.id);
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = processedMessage;
                    console.log('Updated existing message:', {
                      messageId: processedMessage.id,
                      content: processedMessage.content,
                      timestamp: processedMessage.created_at || processedMessage.inserted_at
                    });
                    return updated;
                  }
                  return prev;
                });
              }
            }
          } catch (err) {
            console.error('Error processing message update:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (!isCurrentSubscription) return;
          
        if (err) {
          console.error('Message subscription error:', err);
            if (err.message?.includes('Too many channels') && retryCount < maxRetries) {
              console.log(`Retry attempt ${retryCount + 1} of ${maxRetries}`);
              retryCount++;
              
              // Clean up all channels
            supabase.getChannels().forEach(ch => {
                supabase.removeChannel(ch);
            });
              
              // Wait before retrying
            setTimeout(() => {
              if (isCurrentSubscription) {
                  setupChannel();
              }
              }, 1000 * retryCount); // Exponential backoff
          }
        } else {
          console.log('Subscription status:', status);
            retryCount = 0; // Reset retry count on successful subscription
        }
      });

    subscriptionRef.current = channel;
    };

    setupChannel();

    return () => {
      console.log('Cleaning up subscription on unmount:', subscriptionId);
      isCurrentSubscription = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, channelId, chatType, updateMessages]);

  const sendMessage = useCallback(
    async (
      content: string,
      attachmentUrl?: string,
      fileMetadata?: { filename: string; contentType: string; size: number },
      replyToId?: string
    ) => {
      if (!user) throw new Error('No user found');
      if (!channelId) throw new Error('No channel selected');
      if (isMembershipLoading) throw new Error('Membership status is still loading');
      if (!memberData) {
        // Try to fetch member data one more time
        try {
          const { data: fetchedMemberData, error: memberError } = chatType === 'dm'
            ? await supabase
                .from('direct_message_members')
                .select('id, profile_id')
                .eq('channel_id', channelId)
                .eq('user_id', user.id)
                .single()
            : await supabase
                .from('channel_members')
                .select('id, profile_id')
                .eq('channel_id', channelId)
                .eq('user_id', user.id)
                .single();

          if (memberError || !fetchedMemberData) {
            throw new Error('Could not find member data. Please try again.');
          }
          
          setMemberData(fetchedMemberData);
        } catch (err) {
          throw new Error('Could not find member data. Please try again.');
        }
      }
      
      const trimmedContent = content.trim();
      const now = new Date().toISOString();

      const effectiveParentId = replyToId || parentId || null;

      try {
        let result;
        if (chatType === 'dm') {
          // Get the other user's ID from the channel members
          const { data: channelMembers, error: membersError } = await supabase
            .from('direct_message_members')
            .select('user_id')
            .eq('channel_id', channelId);

          if (membersError) throw membersError;

          const otherUserId = channelMembers?.find(member => member.user_id !== user.id)?.user_id;
          if (!otherUserId) throw new Error('Could not find other user in channel');

          // Check if the other user is the test user
          const { data: otherUser, error: userError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', otherUserId)
            .single();

          if (userError) throw userError;

          // If sending to test user, redirect to API
          if (otherUser.username === 'testuser@gmail.com') {
            // First create the message in the database from current user
            const messageData = {
              channel_id: channelId,
              user_id: user.id,
              profile_id: memberData.profile_id,
              content: trimmedContent || ' ',
              parent_id: effectiveParentId,
              message_type: attachmentUrl ? 'file' : 'text',
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

            const { data: messageResult, error: messageError } = await supabase
              .from('direct_messages')
              .insert(messageData)
              .select(`
                *,
                profile:profiles!direct_messages_profile_id_fkey(
                  id,
                  username,
                  full_name,
                  avatar_url
                )
              `)
              .single();

            if (messageError) throw messageError;

            // Get current session for API request
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.access_token) {
              throw new Error('No active session or missing access token');
            }

            // Make API request to get test user's response
            const response = await fetch('http://localhost:8000/api/chat/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                content: trimmedContent,
                target_user_id: otherUserId, // Send to test user
                mode: 'direct'
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            return messageResult; // Return the original message result
          }

          // Regular DM message handling
          const messageData = {
            channel_id: channelId,
            user_id: user.id,
            profile_id: memberData.profile_id,
            content: trimmedContent || ' ',
            parent_id: effectiveParentId,
            message_type: attachmentUrl ? 'file' : 'text',
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
            .select(`
              *,
              profile:profiles!direct_messages_profile_id_fkey(
                id,
                username,
                full_name,
                avatar_url
              )
            `)
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
