import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  message_reactions: MessageReaction[]
  message_attachments: MessageAttachment[]
}

interface MessageReaction {
  message_id: string
  user_id: string
  emoji: string
}

interface MessageAttachment {
  id: string
  message_id: string
  file_name: string
  file_url: string
}

interface UseRealtimeMessagesProps {
  channelId: string
  chatType?: 'channel' | 'dm'
}

export function useRealtimeMessages({ channelId, chatType = 'channel' }: UseRealtimeMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Load initial messages and setup subscription only when we have a channelId
  useEffect(() => {
    if (!channelId) {
      setMessages([])
      setIsLoading(false)
      setError(null)
      setHasMore(false)
      return
    }

    loadMessages()
    
    // Subscribe to message changes
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: chatType === 'dm' ? 'direct_messages' : 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('Received real-time message:', payload)
          const newMessage = payload.new as Message
          if (payload.eventType === 'INSERT') {
            // Transform DM message to match Message interface
            const transformedMessage = chatType === 'dm' ? {
              ...newMessage,
              message_reactions: [],
              message_attachments: []
            } : newMessage

            setMessages(prev => [...prev, transformedMessage])
          } else if (payload.eventType === 'UPDATE') {
            // Transform DM message to match Message interface
            const transformedMessage = chatType === 'dm' ? {
              ...newMessage,
              message_reactions: [],
              message_attachments: []
            } : newMessage

            setMessages(prev => 
              prev.map(msg => 
                msg.id === transformedMessage.id ? transformedMessage : msg
              )
            )
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up subscription for channel:', channelId)
      channel.unsubscribe()
    }
  }, [channelId, chatType])

  const loadMessages = async (cursor?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      if (!channelId) {
        console.log('No channel ID provided')
        setMessages([])
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Get the profile for the current user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Error getting user profile:', profileError)
        throw new Error('Could not get user profile')
      }

      console.log('Loading messages for channel:', channelId)

      // First verify membership
      if (chatType === 'channel') {
        const { data: channelMembership, error: channelError } = await supabase
          .from('channel_members')
          .select('*')
          .eq('channel_id', channelId)
          .eq('user_id', user.id)
          .single()

        if (channelError && channelError.code !== 'PGRST116') {
          console.error('Channel membership check failed:', channelError)
          throw new Error('Not a member of this channel')
        }

        if (!channelMembership) {
          throw new Error('Not a member of this channel')
        }
      } else {
        // DM membership check
        const { error: dmError, data: dmMembership } = await supabase
          .from('direct_message_members')
          .select('*')
          .eq('channel_id', channelId)
          .eq('user_id', user.id)
          .single()

        if (dmError) {
          console.error('DM membership check failed:', dmError)
          throw new Error('Not a member of this conversation (DM membership missing).')
        }

        if (!dmMembership) {
          console.error('No DM membership found for user:', user.id, 'channel:', channelId)
          throw new Error('Not a member of this conversation.')
        }

        console.log('DM membership found:', dmMembership)
      }

      // If we get here, user is a member of this channel or DM
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      let query = supabase
        .from(table)
        .select(chatType === 'channel' ? `
          *,
          message_reactions!message_reactions_message_id_fkey(*),
          message_attachments!message_attachments_message_id_fkey(*)
        ` : '*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(25)

      if (cursor) {
        query = query.gt('created_at', cursor)
      }

      const { data, error: loadError } = await query

      if (loadError) {
        console.error('Error loading messages:', loadError)
        throw loadError
      }

      console.log('Successfully loaded messages:', data)
      // Transform DM messages to match Message interface
      const transformedData = chatType === 'dm' 
        ? data?.map((msg: any) => ({
            ...msg,
            message_reactions: [],
            message_attachments: []
          }))
        : data

      setMessages(prev => cursor ? [...transformedData, ...prev] : transformedData)
      setHasMore(data?.length === 25)

    } catch (err) {
      console.error('Failed to load messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to load messages'))
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string) => {
    try {
      console.log('Sending message to channel:', channelId, 'type:', chatType)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Get profile_id only for DMs
      let profile_id: string | undefined
      if (chatType === 'dm') {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error getting profile:', profileError)
          throw new Error('Could not get user profile')
        }
        profile_id = profile.id
      }

      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      console.log('Using table:', table)

      if (chatType === 'dm') {
        // Debug: Check that there's a row in "direct_message_channels" for this channelId
        const { data: dmChannel, error: dmChannelErr } = await supabase
          .from('direct_message_channels')
          .select('*')
          .eq('id', channelId)
          .single()

        if (dmChannelErr) {
          console.error('Error retrieving "direct_message_channels" row:', dmChannelErr)
        } else if (!dmChannel) {
          console.error('No row found in "direct_message_channels" for channel:', channelId)
        } else {
          console.log('Found direct_message_channels row:', dmChannel)
        }

        // Update the channel's updated_at timestamp
        const { error: updateError, data: updateData } = await supabase
          .from('direct_message_channels')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', channelId)      

        if (updateError) {
          console.error('Error updating DM channel timestamp:', updateError)
          console.error('DM channel update response:', updateData)
          // Continue anyway
        }
      }

      // Create message data based on chat type
      const messageData = {
        channel_id: channelId,
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(chatType === 'dm' ? { profile_id } : {})  // Only include profile_id for DMs
      }

      const { data, error: sendError } = await supabase
        .from(table)
        .insert(messageData)
        .select()
        .single()

      if (sendError) {
        console.error('Error sending message:', sendError)
        throw new Error(sendError.message ?? 'Failed to send message (no details)')
      }

      console.log('Message sent successfully:', data)

      // Transform DM message to match Message interface
      const transformedMessage = chatType === 'dm' ? {
        ...data,
        message_reactions: [],
        message_attachments: []
      } : data

      // Update local state immediately
      setMessages(prev => [...prev, transformedMessage])

      return transformedMessage

    } catch (err) {
      console.error('Failed to send message:', err)
      throw err instanceof Error ? err : new Error('Failed to send message')
    }
  }

  const updateMessage = async (messageId: string, content: string) => {
    try {
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      const { data, error: updateError } = await supabase
        .from(table)
        .update({ content })
        .eq('id', messageId)
        .select()
        .single()

      if (updateError) throw updateError
      return data

    } catch (err) {
      console.error('Failed to update message:', err)
      throw err instanceof Error ? err : new Error('Failed to update message')
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Only regular channels support reactions
      if (chatType === 'dm') {
        throw new Error('Reactions are not supported in direct messages')
      }

      // Check if user has already reacted with this emoji
      const { data: existingReaction, error: checkError } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw checkError
      }

      if (existingReaction) {
        // Remove existing reaction
        const { error: deleteError } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji)

        if (deleteError) throw deleteError
      } else {
        // Add new reaction
        const { error: addError } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji
          })
        if (addError) throw addError
      }

      // Fetch updated message to get all reactions
      const { data: updatedMessage, error: messageError } = await supabase
        .from('messages')
        .select(`
          *,
          message_reactions!message_reactions_message_id_fkey(*),
          message_attachments!message_attachments_message_id_fkey(*)
        `)
        .eq('id', messageId)
        .single()

      if (messageError) throw messageError

      if (updatedMessage) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          )
        )
      }

      return updatedMessage

    } catch (err) {
      console.error('Failed to toggle reaction:', err)
      throw err instanceof Error ? err : new Error('Failed to toggle reaction')
    }
  }

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore: () => loadMessages(messages[messages.length - 1]?.created_at),
    sendMessage,
    updateMessage,
    addReaction
  }
} 