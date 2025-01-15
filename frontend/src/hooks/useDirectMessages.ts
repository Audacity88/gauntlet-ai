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
        setConversationMessages(new Map())
        return
      }

      // Get all DM channels with their members
      const { data: channels, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          updated_at,
          members:direct_message_members(
            id,
            user_id,
            profile_id,
            last_read_at,
            username,
            full_name,
            avatar_url
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
          updated_at,
          attachments
        `)
        .order('created_at', { ascending: false })

      if (messagesError) {
        console.error('Failed to load DM messages:', messagesError)
        throw messagesError
      }

      // Process and group messages by channel
      const channelMap = new Map()
      channels.forEach(channel => {
        const members = channel.members || []
        const otherMember = members.find(m => m.user_id !== user.id)
        if (otherMember) {
          channelMap.set(channel.id, {
            id: channel.id,
            members: members.map(m => ({ 
              user: {
                id: m.user_id,
                username: m.username,
                full_name: m.full_name,
                avatar_url: m.avatar_url
              },
              last_read_at: m.last_read_at 
            })),
            otherUser: {
              id: otherMember.user_id,
              username: otherMember.username,
              full_name: otherMember.full_name,
              avatar_url: otherMember.avatar_url
            },
            messages: messages
              .filter(m => m.channel_id === channel.id)
              .map(m => {
                const memberInfo = members.find(member => member.user_id === m.user_id)
                return {
                  ...m,
                  user: memberInfo ? {
                    id: memberInfo.user_id,
                    username: memberInfo.username,
                    full_name: memberInfo.full_name,
                    avatar_url: memberInfo.avatar_url
                  } : null
                }
              }),
            last_read_at: members.find(m => m.user_id === user.id)?.last_read_at,
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

      // First check if a DM channel already exists between these users
      const { data: existingChannel, error: existingError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          members:direct_message_members(user_id)
        `)
        .contains('members', [{ user_id: user.id }, { user_id: otherProfile.id }])
        .single()

      if (!existingError && existingChannel) {
        return existingChannel.id
      }

      // If no channel exists, create one
      const { data: newChannel, error: channelError } = await supabase
        .from('direct_message_channels')
        .insert({})
        .select('id')
        .single()

      if (channelError) {
        console.error('Channel creation error:', channelError)
        throw new Error('Failed to create DM channel')
      }

      // Add both users as members
      const { error: membersError } = await supabase
        .from('direct_message_members')
        .insert([
          {
            channel_id: newChannel.id,
            user_id: user.id,
            profile_id: user.id
          },
          {
            channel_id: newChannel.id,
            user_id: otherProfile.id,
            profile_id: otherProfile.id
          }
        ])

      if (membersError) {
        console.error('Member creation error:', membersError)
        throw new Error('Failed to add users to DM channel')
      }

      // Refresh channels to include the new one
      await loadChannels()

      return newChannel.id
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