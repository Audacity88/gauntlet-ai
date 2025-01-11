import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Message, DirectMessage } from '../types/schema'
import { User } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useMessageStore } from '../stores/messageStore'
import { getMessageProcessor, MessageType, AnyMessage } from '../utils/MessageProcessor'

// Create a persistent user cache outside the component
const userCache = new Map<string, User>();
const loadingUsers = new Set<string>();

interface UseRealtimeMessagesProps {
  channelId: string
  chatType?: MessageType
  searchQuery?: string
}

interface MembershipCache {
  [key: string]: boolean
}

export function useRealtimeMessages({ 
  channelId, 
  chatType = 'channel', 
  searchQuery 
}: UseRealtimeMessagesProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [membershipCache] = useState<MembershipCache>({})
  const { user } = useAuth()
  
  // Use message store for state management
  const { 
    messages: storeMessages,
    optimisticMessages,
    addMessage,
    updateMessage,
    removeMessage,
    setMessages,
    setLoading,
    setError: setStoreError,
    clearMessages
  } = useMessageStore()

  // Clear messages when changing channels
  useEffect(() => {
    clearMessages()
  }, [channelId, chatType, clearMessages])

  // Memoize messages array from store
  const messages = useMemo(() => {
    const allMessages = Array.from(storeMessages.values())
    const optimistic = Array.from(optimisticMessages.values())
    return [...allMessages, ...optimistic].sort((a, b) => {
        const getTime = (msg: AnyMessage) => {
        const timestamp = chatType === 'dm' ? msg.created_at : msg.inserted_at
          return new Date(timestamp || new Date().toISOString()).getTime()
        }
        return getTime(a) - getTime(b)
      })
  }, [storeMessages, optimisticMessages, chatType])

  // Create message processor
  const messageProcessor = useMemo(() => {
    const getUserById = async (id: string) => {
      if (userCache.has(id)) {
        return userCache.get(id);
      }
      
      if (loadingUsers.has(id)) {
        return undefined;
      }
      
      loadingUsers.add(id);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (data) {
        userCache.set(id, data);
        // Force a re-render by updating any messages from this user
        const userMessages = messages.filter(m => m.user_id === id);
        userMessages.forEach(message => {
          updateMessage(message.id, { ...message, user: data });
        });
      }
      loadingUsers.delete(id);
      return data;
    };
    
    return getMessageProcessor({
      chatType,
      getUserById: (id: string) => {
        const cachedUser = userCache.get(id);
        if (!cachedUser && !loadingUsers.has(id)) {
          getUserById(id);
        }
        return cachedUser;
      }
    });
  }, [chatType, updateMessage]);

  // Process and add new message
  const processMessage = useCallback((newMessage: Message | DirectMessage) => {
    const processed = messageProcessor.processMessage(newMessage)
    if (processed) {
      addMessage(processed)
    }
  }, [messageProcessor, addMessage])

  // Update realtime subscription
  useEffect(() => {
    if (!channelId || !user) return
    
    // Clear processed messages when changing channels
    messageProcessor.clearProcessedIds()
    
    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
    const channel = supabase
      .channel(`${table}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          if (payload.new && 'id' in payload.new) {
            const messageId = payload.new.id as string
            if (!messageProcessor.hasProcessed(messageId)) {
              processMessage(payload.new as Message | DirectMessage)
            }
          }
        }
      )
      .subscribe()

    return () => {
      messageProcessor.clearProcessedIds()
      supabase.removeChannel(channel)
    }
  }, [channelId, chatType, user, messageProcessor, processMessage])

  // Load initial messages
  useEffect(() => {
    if (!channelId || !user) return

    let mounted = true
    
    const loadInitialMessages = async () => {
      setLoading(true)
      setError(null)

      try {
        const table = chatType === 'dm' ? 'direct_messages' : 'messages'
        let query = supabase
          .from(table)
          .select(`
            *,
            user:profiles(*)
          `)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })

        // Add search filter if search query is provided
        if (searchQuery?.trim()) {
          query = query.ilike('content', `%${searchQuery.trim()}%`)
        }

        // Add limit only if no search query
        if (!searchQuery) {
          query = query.limit(50)
        }

        const { data, error: queryError } = await query

        if (queryError) throw queryError

        if (data && mounted) {
          const processed = messageProcessor.processMessages(data)
          setMessages(processed)
          setHasMore(!searchQuery && data.length === 50)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load messages')
        if (mounted) {
          setError(error)
          setStoreError(error)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadInitialMessages()

    return () => {
      mounted = false
    }
  }, [channelId, chatType, user, messageProcessor, setMessages, setLoading, setStoreError, searchQuery])

  // Check DM membership
  const checkDmMembership = useCallback(async () => {
    if (!user || chatType !== 'dm' || !channelId) return true
    
    const cacheKey = `dm-${channelId}-${user.id}`
    
    if (membershipCache[cacheKey] !== undefined) {
      return membershipCache[cacheKey]
    }

    const { error: dmError, data: dmMembership } = await supabase
      .from('direct_message_members')
      .select('*')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single()

    if (dmError) {
      console.error('DM membership check error:', dmError)
    }

    membershipCache[cacheKey] = !!dmMembership
    return !!dmMembership
  }, [channelId, user?.id, chatType, membershipCache])

  // Send message
  const sendMessage = useCallback(async (content: string, attachmentUrl?: string, fileMetadata?: { filename: string, contentType: string, size: number }) => {
    if (!user) throw new Error('No user found')
    const trimmedContent = content.trim()

    if (chatType === 'dm') {
      const hasMembership = await checkDmMembership()
      if (!hasMembership) {
        throw new Error('Not a member of this DM channel')
      }

      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          profile_id: user.id,
          content: trimmedContent || ' ',
          attachments: attachmentUrl ? [{
            url: attachmentUrl,
            file_path: attachmentUrl,
            filename: fileMetadata?.filename || attachmentUrl.split('/').pop() || 'attachment',
            content_type: fileMetadata?.contentType || 'application/octet-stream',
            size: fileMetadata?.size || 0
          }] : undefined
        })
        .select('*, user:profiles(*)')
        .single()

      if (error) throw error
      return data
    } else {
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('profile_id, role')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single()

      if (memberError) throw memberError
      if (!memberData?.profile_id) {
        throw new Error('No profile ID found for user in this channel')
      }

      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          profile_id: memberData.profile_id,
          content: trimmedContent || ' ',
          attachments: attachmentUrl ? [{
            url: attachmentUrl,
            file_path: attachmentUrl,
            filename: fileMetadata?.filename || attachmentUrl.split('/').pop() || 'attachment',
            content_type: fileMetadata?.contentType || 'application/octet-stream',
            size: fileMetadata?.size || 0
          }] : undefined,
          inserted_at: now,
          updated_at: now
        })
        .select('*, profile:profiles(*)')
        .single()

      if (error) throw error
      return data
    }
  }, [user, channelId, chatType, checkDmMembership])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    sendMessage
  }
} 