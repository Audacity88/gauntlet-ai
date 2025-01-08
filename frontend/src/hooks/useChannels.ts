import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface Channel {
  id: string
  name: string
  description: string | null
  is_private: boolean
  created_by: string
  created_at: string
  updated_at: string
  member_count?: number
}

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load channels on mount
  useEffect(() => {
    loadChannels()
    
    // Subscribe to channel changes
    const channel = supabase
      .channel('public:channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        (payload) => {
          console.log('Received channel change:', payload)
          if (payload.eventType === 'INSERT') {
            setChannels(prev => [...prev, payload.new as Channel])
          } else if (payload.eventType === 'UPDATE') {
            setChannels(prev => 
              prev.map(ch => 
                ch.id === payload.new.id ? payload.new as Channel : ch
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setChannels(prev => 
              prev.filter(ch => ch.id !== payload.old.id)
            )
          }
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

      // First get channels where user is a member
      const { data: memberChannels, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id)

      if (memberError) {
        console.error('Error loading channel memberships:', memberError)
        throw memberError
      }

      const channelIds = memberChannels?.map(m => m.channel_id) || []

      // Then get all public channels and channels where user is a member
      const { data, error: loadError } = await supabase
        .from('channels')
        .select(`
          *,
          member_count:channel_members(count)
        `)
        .or(
          channelIds.length > 0 
            ? `is_private.eq.false,id.in.(${channelIds.join(',')})`
            : 'is_private.eq.false'
        )
        .order('created_at', { ascending: false })

      if (loadError) {
        console.error('Supabase error loading channels:', loadError)
        throw loadError
      }

      console.log('Channels data:', data)

      setChannels(data.map(channel => ({
        ...channel,
        member_count: channel.member_count[0].count
      })))

    } catch (err) {
      console.error('Failed to load channels:', err)
      setError(err instanceof Error ? err : new Error('Failed to load channels'))
    } finally {
      setIsLoading(false)
    }
  }

  interface CreateChannelParams {
    name: string
    description?: string
    is_private?: boolean
  }

  const createChannel = async ({ name, description = '', is_private = false }: CreateChannelParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      console.log('Creating channel with params:', { name, description, is_private, created_by: user.id })

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          name,
          description,
          is_private,
          created_by: user.id
        })
        .select<'channels', Channel>()
        .single()

      if (channelError) {
        console.error('Failed to create channel:', {
          error: channelError,
          code: channelError.code,
          details: channelError.details,
          hint: channelError.hint,
          message: channelError.message
        })
        throw channelError
      }

      console.log('Successfully created channel:', channel)

      // Add creator as member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          role: 'admin'
        })

      if (memberError) {
        console.error('Failed to add member:', {
          error: memberError,
          code: memberError.code,
          details: memberError.details,
          hint: memberError.hint,
          message: memberError.message
        })
        throw memberError
      }

      console.log('Successfully added creator as member')
      
      // Update local state with the new channel
      setChannels(prev => [{
        ...channel,
        member_count: 1 // Initial member count is 1 (the creator)
      }, ...prev])
      
      return channel

    } catch (err) {
      console.error('Failed to create channel:', {
        error: err,
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err)
      })
      throw err instanceof Error ? err : new Error('Failed to create channel')
    }
  }

  const updateChannel = async (channelId: string, updates: Partial<Channel>) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .update(updates)
        .eq('id', channelId)
        .select()
        .single()

      if (error) throw error
      
      // Update the channel in local state
      if (data) {
        setChannels(prev => 
          prev.map(ch => 
            ch.id === channelId 
              ? { ...ch, ...data }
              : ch
          )
        )
      }
      
      return data

    } catch (err) {
      console.error('Failed to update channel:', err)
      throw err instanceof Error ? err : new Error('Failed to update channel')
    }
  }

  const deleteChannel = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId)

      if (error) throw error

      // Remove the channel from local state
      setChannels(prev => prev.filter(ch => ch.id !== channelId))

    } catch (err) {
      console.error('Failed to delete channel:', err)
      throw err instanceof Error ? err : new Error('Failed to delete channel')
    }
  }

  const deleteAllChannels = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      // Delete all channels created by the current user
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('created_by', user.id)

      if (error) throw error
      
      // Remove all user-created channels from local state
      setChannels(prev => prev.filter(ch => ch.created_by !== user.id))

    } catch (err) {
      console.error('Failed to delete all channels:', err)
      throw err instanceof Error ? err : new Error('Failed to delete all channels')
    }
  }

  const joinChannel = async (channelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { data, error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          role: 'member'
        })
        .select()
        .single()

      if (error) throw error

      // Increment the member count in local state
      setChannels(prev => 
        prev.map(ch => 
          ch.id === channelId 
            ? { ...ch, member_count: (ch.member_count || 0) + 1 }
            : ch
        )
      )

      return data

    } catch (err) {
      console.error('Failed to join channel:', err)
      throw err instanceof Error ? err : new Error('Failed to join channel')
    }
  }

  const leaveChannel = async (channelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', user.id)

      if (error) throw error

    } catch (err) {
      console.error('Failed to leave channel:', err)
      throw err instanceof Error ? err : new Error('Failed to leave channel')
    }
  }

  return {
    channels,
    isLoading,
    error,
    createChannel,
    updateChannel,
    deleteChannel,
    deleteAllChannels,
    joinChannel,
    leaveChannel,
    refresh: loadChannels
  }
} 