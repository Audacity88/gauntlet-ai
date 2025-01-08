import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

interface DatabaseChannel {
  id: string
  created_at: string
  updated_at: string
  members: Array<{
    user_id: string
    last_read_at: string
    profile: {
      username: string
      full_name: string | null
      avatar_url: string | null
    }
  }>
}

export interface DirectMessageChannel extends DatabaseChannel {
  last_message?: {
    content: string
    created_at: string
  }
  unread_count: number
}

export function useDirectMessages() {
  const [channels, setChannels] = useState<DirectMessageChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load DM channels on mount
  useEffect(() => {
    loadChannels()
    
    // Subscribe to new messages
    const channel = supabase
      .channel('direct_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          console.log('New message:', payload)
          loadChannels() // Reload to get updated unread counts and last message
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const loadChannels = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // First get all DM channels where user is a member
      const { data: memberChannels, error: memberError } = await supabase
        .from('direct_message_members')
        .select('channel_id')
        .eq('user_id', user.id)

      if (memberError) {
        console.error('Error loading DM memberships:', memberError)
        throw memberError
      }

      if (!memberChannels?.length) {
        setChannels([])
        return
      }

      // Then get the channels and their members
      const { data: rawChannels, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          updated_at,
          members:direct_message_members(
            user_id,
            last_read_at,
            profiles:profiles(
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .in('id', memberChannels.map(m => m.channel_id))
        .order('updated_at', { ascending: false })

      if (channelsError) {
        console.error('Supabase error loading DM channels:', channelsError)
        throw channelsError
      }

      // Transform the raw data to match our types
      const channels = rawChannels as unknown as DatabaseChannel[]

      // Then for each channel, get the last message and unread count
      const channelsWithMessages = await Promise.all(
        channels.map(async (channel) => {
          // Get last message
          const { data: messages, error: messagesError } = await supabase
            .from('direct_messages')
            .select('content, created_at')
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

          const result: DirectMessageChannel = {
            ...channel,
            last_message: messages?.[0],
            unread_count: count || 0
          }

          return result
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Get current user's profile using auth.uid()
      const { data: currentProfile, error: currentProfileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .single()

      if (currentProfileError || !currentProfile) {
        console.error('Error finding current user profile:', currentProfileError)
        throw new Error('Current user profile not found')
      }

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

      // Use RPC to find or create DM channel
      const { data: result, error: rpcError } = await supabase
        .rpc('find_or_create_dm_channel', {
          user1_id: user.id,
          user2_id: otherProfile.id,
          user1_profile_id: currentProfile.id,
          user2_profile_id: otherProfile.id
        })

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        throw new Error('Failed to create or find DM channel')
      }

      console.log('DM channel result:', result)
      return result.channel_id

    } catch (err) {
      console.error('Failed to create DM:', err)
      throw err instanceof Error ? err : new Error('Failed to create DM')
    }
  }

  const markChannelAsRead = async (channelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      await supabase
        .from('direct_message_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id)

      setChannels(prev => 
        prev.map(ch => 
          ch.id === channelId ? { ...ch, unread_count: 0 } : ch
        )
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
      throw err instanceof Error ? err : new Error('Failed to mark as read')
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