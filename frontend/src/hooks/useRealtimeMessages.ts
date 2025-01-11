import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Message, DirectMessage } from '../types/schema'
import { User } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useMessageStore } from '../stores/messageStore'
import { getMessageProcessor, MessageType, AnyMessage } from '../utils/MessageProcessor'

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
    setError: setStoreError
  } = useMessageStore()

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
    return getMessageProcessor({
      chatType,
      getUserById: (id: string) => messages.find(m => m.user.id === id)?.user
    })
  }, [chatType, messages])

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
    
    const loadInitialMessages = async () => {
      setLoading(true)
      setError(null)

      try {
        const table = chatType === 'dm' ? 'direct_messages' : 'messages'
        const { data, error: queryError } = await supabase
          .from(table)
          .select(`
            *,
            user:profiles(*)
          `)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })
          .limit(50)

        if (queryError) throw queryError

        if (data) {
          const processed = messageProcessor.processMessages(data)
          setMessages(processed)
          setHasMore(data.length === 50)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load messages')
        setError(error)
        setStoreError(error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialMessages()
  }, [channelId, chatType, user, messageProcessor, setMessages, setLoading, setStoreError])

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
  const sendMessage = useCallback(async (content: string) => {
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
          content: trimmedContent || ' '
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