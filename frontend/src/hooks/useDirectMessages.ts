import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DirectMessageChannelWithMembers, DirectMessage} from '../types/schema'
import { useAuth } from '../hooks/useAuth'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useDirectMessages() {
  const [channels, setChannels] = useState<DirectMessageChannelWithMembers[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return

    loadChannels()
    
    // Subscribe to new messages and channel updates
    const channel = supabase
      .channel('direct_messages_updates')
      .on(
        'postgres_changes' as const,
        { 
          event: '*', 
          schema: 'public', 
          table: 'direct_messages'
        },
        async (payload: RealtimePostgresChangesPayload<DirectMessage>) => {
          console.log('New DM message:', payload)
          
          // Get the channel ID from the message
          const channelId = (payload.new as DirectMessage)?.channel_id
          if (!channelId) return

          // Get the channel from local state
          const channel = channels.find(ch => ch.id === channelId)
          if (!channel) return

          // Update the channel with the new message directly from the payload
          setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
              // Calculate unread count locally
              const lastReadAt = ch.members.find(m => m.user_id === user.id)?.last_read_at || ''
              const newMessage = payload.new
              const isUnread = !lastReadAt || (newMessage && 'created_at' in newMessage && newMessage.created_at > lastReadAt)
              
              return {
                ...ch,
                last_message: newMessage as DirectMessage,
                unread_count: isUnread ? (ch.unread_count || 0) + 1 : ch.unread_count || 0
              }
            }
            return ch
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_message_channels'
        },
        (payload) => {
          console.log('DM channel updated:', payload)
          // Only reload channels for structural changes
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            loadChannels()
          }
        }
      )
      .subscribe((status) => {
        console.log('DM subscription status:', status)
      })

    return () => {
      console.log('Cleaning up DM subscriptions')
      channel.unsubscribe()
    }
  }, [user])

  const loadChannels = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) {
        setChannels([])
        return
      }

      // Use the new simplified function to get all channel data
      const { data: channelData, error: channelsError } = await supabase
        .rpc('get_dm_channels_for_user', {
          user_uuid: user.id
        })

      if (channelsError) {
        console.error('Error loading DM channels:', channelsError)
        throw channelsError
      }

      // Transform the data into the expected format
      const formattedChannels = channelData.map(ch => ({
        id: ch.channel_id,
        created_at: ch.last_message_at || new Date().toISOString(),
        updated_at: ch.last_message_at || new Date().toISOString(),
        members: [
          {
            id: `${ch.channel_id}-${user.id}`,
            channel_id: ch.channel_id,
            user_id: user.id,
            profile_id: user.id,
            last_read_at: ch.last_read_at,
            created_at: ch.last_message_at || new Date().toISOString(),
            user: {
              id: user.id,
              username: user.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          },
          {
            id: `${ch.channel_id}-${ch.other_user_id}`,
            channel_id: ch.channel_id,
            user_id: ch.other_user_id,
            profile_id: ch.other_profile_id,
            last_read_at: null,
            created_at: ch.last_message_at || new Date().toISOString(),
            user: {
              id: ch.other_profile_id,
              username: ch.other_username,
              full_name: ch.other_full_name,
              avatar_url: ch.other_avatar_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        ],
        last_message: ch.last_message_content ? {
          id: 'temp',
          channel_id: ch.channel_id,
          content: ch.last_message_content,
          created_at: ch.last_message_at || new Date().toISOString(),
          updated_at: ch.last_message_at || new Date().toISOString()
        } : undefined,
        unread_count: ch.unread_count
      }))

      setChannels(formattedChannels)
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
        .select('id, username')
        .eq('username', otherUsername)
        .single()

      if (userError || !otherProfile) {
        console.error('Error finding user:', userError)
        throw new Error('User not found')
      }

      // Get our own profile
      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (myProfileError || !myProfile) {
        console.error('Error finding own profile:', myProfileError)
        throw new Error('Profile not found')
      }

      // Use the simplified function to find or create DM channel
      const { data: channelId, error: rpcError } = await supabase
        .rpc('find_or_create_dm_channel', {
          p_user_id: user.id,
          p_other_user_id: otherProfile.id
        })

      if (rpcError) {
        console.error('Error creating DM channel:', rpcError)
        throw new Error('Failed to create DM channel')
      }

      // Refresh the channels list
      loadChannels()

      return channelId
    } catch (err) {
      console.error('Failed to create DM:', err)
      throw err
    }
  }

  const markChannelAsRead = async (channelId: string) => {
    if (!user || !channelId) return

    try {
      // Use the simplified function to update last read timestamp
      const { error } = await supabase
        .rpc('update_dm_last_read', {
          p_channel_id: channelId,
          p_user_id: user.id
        })

      if (error) {
        console.error('Error marking channel as read:', error)
        return
      }

      // Update local state
      setChannels(prev => prev.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            unread_count: 0,
            members: ch.members.map(m => 
              m.user_id === user.id 
                ? { ...m, last_read_at: new Date().toISOString() }
                : m
            )
          }
        }
        return ch
      }))
    } catch (err) {
      console.error('Failed to mark channel as read:', err)
    }
  }

  return {
    channels,
    isLoading,
    error,
    createDirectMessage,
    markChannelAsRead
  }
} 