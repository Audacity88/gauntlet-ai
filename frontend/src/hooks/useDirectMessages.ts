import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DirectMessage, User } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useDirectMessageStore } from '../stores/directMessageStore'
import { getDirectMessageProcessor, DirectMessageWithDetails } from '../utils/DirectMessageProcessor'
import { useUserStore } from '../stores/userStore'

export function useDirectMessages() {
  const { user } = useAuth()
  const { users } = useUserStore()
  const {
    conversations = new Map(),
    loading,
    error,
    setLoading,
    setError,
    setConversationMessages,
    addMessage,
    updateMessage,
    removeMessage
  } = useDirectMessageStore()

  const messageProcessor = useCallback(() => {
    if (!user) return null
    return getDirectMessageProcessor({
      getUserById: (id: string) => users.get(id),
      currentUserId: user.id
    })
  }, [user, users])

  // Load DM channels on mount and set up realtime subscription
  useEffect(() => {
    if (!user) return

    loadChannels()
    
    // Subscribe to new messages and channel updates
    const channel = supabase
      .channel('direct_messages_updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'direct_messages'
        },
        async (payload) => {
          const processor = messageProcessor()
          if (!processor) return

          if (payload.eventType === 'INSERT') {
            const processed = processor.processDirectMessage(payload.new as DirectMessage)
            if (processed) {
              addMessage(processed)
            }
          } else if (payload.eventType === 'UPDATE') {
            const processed = processor.processDirectMessage({
              ...payload.new as DirectMessage,
              eventType: 'UPDATE'
            })
            if (processed) {
              updateMessage(processed.id, processed)
            }
          } else if (payload.eventType === 'DELETE') {
            removeMessage(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user, messageProcessor, addMessage, updateMessage, removeMessage])

  const loadChannels = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) {
        setConversationMessages('', [])
        return
      }

      const processor = messageProcessor()
      if (!processor) return

      // Get all DM channels with their members and member profiles
      const { data: channels, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          updated_at,
          members:direct_message_members(
            user_id,
            username,
            full_name,
            avatar_url,
            last_read_at
          )
        `)
        .order('updated_at', { ascending: false })

      if (channelsError) {
        console.error('Failed to load DM channels:', channelsError)
        throw channelsError
      }

      // Get messages for each channel
      const { data: messages, error: messagesError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          channel_id,
          user_id,
          profile_id,
          content,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      if (messagesError) {
        console.error('Failed to load DM messages:', messagesError)
        throw messagesError
      }

      // Process and group messages by channel
      const channelMap = new Map()
      channels.forEach(channel => {
        const otherMember = channel.members.find(m => m.user_id !== user.id)
        if (otherMember) {
          channelMap.set(channel.id, {
            id: channel.id,
            otherUser: {
              id: otherMember.user_id,
              username: otherMember.username,
              full_name: otherMember.full_name,
              avatar_url: otherMember.avatar_url
            },
            messages: messages.filter(m => m.channel_id === channel.id),
            last_read_at: otherMember.last_read_at,
            created_at: channel.created_at,
            updated_at: channel.updated_at
          })
        }
      })

      setConversationMessages(channelMap)

    } catch (err) {
      console.error('Failed to load DM channels:', err)
      setError(err instanceof Error ? err : new Error('Failed to load DM channels'))
    } finally {
      setLoading(false)
    }
  }

  const createDirectMessage = async (otherUsername: string) => {
    try {
      if (!user) throw new Error('No authenticated user')

      // Get the other user's profile from their username
      const { data: otherProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', otherUsername)
        .not('id', 'eq', user.id)
        .single()

      if (userError || !otherProfile) {
        throw new Error(userError?.message || `User "${otherUsername}" not found`)
      }

      // Use RPC to find or create DM channel
      const { data: channelId, error: rpcError } = await supabase
        .rpc('find_or_create_dm_channel', {
          p_user_id: user.id,
          p_other_user_id: otherProfile.id
        })

      if (rpcError) {
        console.error('RPC error:', rpcError)
        throw new Error('Failed to create or find DM channel')
      }

      return channelId
    } catch (err) {
      console.error('Failed to create direct message:', err)
      throw err instanceof Error ? err : new Error('Failed to create direct message')
    }
  }

  return {
    conversations,
    loading,
    error,
    createDirectMessage,
    refresh: loadChannels
  }
} 