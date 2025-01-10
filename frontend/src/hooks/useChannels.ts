import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Channel, ChannelWithDetails } from '../types/schema'

export function useChannels() {
  const [channels, setChannels] = useState<ChannelWithDetails[]>([])
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
            setChannels(prev => [payload.new as ChannelWithDetails, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setChannels(prev => 
              prev.map(ch => 
                ch.id === payload.new.id ? payload.new as ChannelWithDetails : ch
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

      // Get all channels and their creators
      const { data, error: loadError } = await supabase
        .from('channels')
        .select(`
          *,
          creator:profiles!channels_created_by_fkey(*)
        `)
        .order('inserted_at', { ascending: false })

      if (loadError) {
        console.error('Supabase error loading channels:', loadError)
        throw loadError
      }

      console.log('Channels data:', data)
      setChannels(data)

    } catch (err) {
      console.error('Failed to load channels:', err)
      setError(err instanceof Error ? err : new Error('Failed to load channels'))
    } finally {
      setIsLoading(false)
    }
  }

  interface CreateChannelParams {
    slug: string
  }

  const createChannel = async ({ slug }: CreateChannelParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      console.log('Creating channel with params:', { slug, created_by: user.id })

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          slug,
          created_by: user.id
        })
        .select(`
          *,
          creator:profiles!channels_created_by_fkey(*)
        `)
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
      
      // Add creator as channel member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          profile_id: user.id,
          role: 'admin'
        })

      if (memberError) {
        console.error('Failed to add creator as channel member:', memberError)
        // Delete the channel since we couldn't add the member
        await supabase.from('channels').delete().eq('id', channel.id)
        throw memberError
      }

      console.log('Successfully added creator as channel member')
      
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
        .select(`
          *,
          creator:profiles!channels_created_by_fkey(*)
        `)
        .single()

      if (error) throw error
      
      if (data) {
        setChannels(prev => 
          prev.map(ch => 
            ch.id === channelId 
              ? data
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

      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('created_by', user.id)

      if (error) throw error
      
      setChannels(prev => prev.filter(ch => ch.created_by !== user.id))

    } catch (err) {
      console.error('Failed to delete all channels:', err)
      throw err instanceof Error ? err : new Error('Failed to delete all channels')
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
    refresh: loadChannels
  }
} 