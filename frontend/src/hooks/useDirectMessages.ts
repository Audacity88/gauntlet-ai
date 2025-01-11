import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DirectMessageChannelWithMembers, DirectMessage} from '../types/schema'
import { useAuth } from '../hooks/useAuth'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useDirectMessages() {
  const [channels, setChannels] = useState<DirectMessageChannelWithMembers[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load DM channels on mount and set up realtime subscription
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
      setIsLoading(true)
      setError(null)

      if (!user) {
        setChannels([])
        return
      }

      // Get all channels and their members in one query
      const { data: rawChannels, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          updated_at,
          members:direct_message_members(
            id,
            channel_id,
            user_id,
            profile_id,
            username,
            full_name,
            avatar_url,
            last_read_at,
            created_at
          )
        `)
        .order('updated_at', { ascending: false })

      if (channelsError) {
        console.error('Supabase error loading DM channels:', channelsError)
        throw channelsError
      }

      // Filter to only include channels where the user is a member
      const userChannels = rawChannels.filter(channel => 
        channel.members.some(member => member.user_id === user.id)
      )

      // Then for each channel, get the last message and unread count
      const channelsWithMessages = await Promise.all(
        userChannels.map(async (channel) => {
          // Get last message
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
            .eq('channel_id', channel.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (messagesError) {
            console.error('Error fetching messages for channel', channel.id, ':', messagesError)
          }

          // Get unread count
          const { count, error: countError } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .gt('created_at', channel.members.find(m => m.user_id === user.id)?.last_read_at || '')

          if (countError) {
            console.error('Error fetching unread count for channel', channel.id, ':', countError)
          }

          // Map members with their profiles
          const typedMembers = channel.members.map(member => ({
            id: member.id,
            channel_id: member.channel_id,
            user_id: member.user_id,
            profile_id: member.profile_id,
            last_read_at: member.last_read_at,
            created_at: member.created_at,
            user: {
              id: member.profile_id,
              username: member.username,
              full_name: member.full_name,
              avatar_url: member.avatar_url,
              created_at: member.created_at,
              updated_at: member.created_at
            }
          }))

          return {
            id: channel.id,
            created_at: channel.created_at,
            updated_at: channel.updated_at,
            members: typedMembers,
            last_message: messages?.[0] as DirectMessage | undefined,
            unread_count: count || 0
          } as DirectMessageChannelWithMembers
        })
      )

      setChannels(channelsWithMessages)
    } catch (err) {
      console.error('Failed to load DM channels:', err)
      setError(err instanceof Error ? err : new Error('Failed to load DM channels'))
    } finally {
      setIsLoading(false)
    }
  }

  const createDirectMessage = async (otherUsername: string) => {
    try {
      if (!user) throw new Error('No authenticated user')

      // Get the other user's profile from their username
      console.log('Looking up user with username:', otherUsername)
      const { data: otherProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', otherUsername)
        .not('id', 'eq', user.id)  // Make sure we don't match ourselves
        .single()

      console.log('User lookup result:', { otherProfile, userError })

      if (userError || !otherProfile) {
        console.error('Error finding user:', userError)
        throw new Error(userError?.message || `User "${otherUsername}" not found`)
      }

      // Use RPC to find or create DM channel
      const { data: result, error: rpcError } = await supabase
        .rpc('find_or_create_dm_channel', {
          p_user_id: user.id,
          p_other_user_id: otherProfile.id
        })

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        throw new Error('Failed to create or find DM channel')
      }

      // The result is a UUID string directly
      if (!result) {
        throw new Error('No channel ID returned')
      }

      // Refresh the channels list
      loadChannels()

      return result

    } catch (err) {
      console.error('Failed to create DM:', err)
      throw err instanceof Error ? err : new Error('Failed to create DM')
    }
  }

  const markChannelAsRead = async (channelId: string) => {
    // Debounce the update to avoid too many requests
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    updateTimeoutRef.current = setTimeout(updateLastRead, 1000)

    const updateLastRead = async (): Promise<void> => {
      try {
        if (!user) throw new Error('No authenticated user')

        const now = new Date().toISOString()

        // Find the member ID for the current user in this channel
        const currentChannel = channels.find(c => c.id === channelId)
        const currentMember = currentChannel?.members.find(m => m.user_id === user.id)
        
        if (!currentMember) {
          console.error('Could not find member record for current user')
          return
        }

        // Update using the RPC function
        const { error: updateError } = await supabase
          .rpc('update_direct_message_member_last_read', {
            p_member_id: currentMember.id,
            p_last_read_at: now
          })

        if (updateError) {
          console.error('Database error marking as read:', updateError)
          throw updateError
        }

        // Update local state
        setChannels(prev => prev.map(channel => {
          if (channel.id === channelId) {
            return {
              ...channel,
              members: channel.members.map(member => {
                if (member.user_id === user?.id) {
                  return {
                    ...member,
                    last_read_at: now
                  }
                }
                return member
              }),
              unread_count: 0
            }
          }
          return channel
        }))
      } catch (error) {
        console.error('Error marking channel as read:', error)
      }
    }
  }

  return {
    channels,
    isLoading,
    error,
    createDirectMessage,
    markChannelAsRead,
    refresh: loadChannels
  }
} 