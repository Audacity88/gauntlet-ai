import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Channel, ChannelWithDetails, User } from '../types/models'
import { getChannelProcessor } from '../utils/ChannelProcessor'
import { useChannelStore } from '../stores/channelStore'
import { useUserCache } from '../hooks/useUserCache'
import { useAuth } from '../hooks/useAuth'

export function useChannels() {
  const { 
    channels, 
    loading,
    error,
    setChannels, 
    setLoading, 
    setError 
  } = useChannelStore()
  const { getUser } = useUserCache()
  const { user } = useAuth()
  
  const channelProcessor = getChannelProcessor({
    getUserById: (id: string) => getUser(id)
  })

  // Load channels on mount
  useEffect(() => {
    let mounted = true;
    
    const loadAndSubscribe = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!user || !mounted) {
          setLoading(false)
          return
        }

        // Get all channels and their creators
        const { data, error: loadError } = await supabase
          .from('channels')
          .select(`
            *,
            creator:profiles!channels_created_by_fkey(*),
            members:channel_members(
              user_id,
              role
            )
          `)
          .order('inserted_at', { ascending: false })

        if (loadError) throw loadError

        // Filter channels to only include those where user is a member
        const processedChannels = await Promise.all(
          (data || [])
            .filter(channel => 
              channel.members?.some((member: any) => member.user_id === user.id)
            )
            .map(channel => channelProcessor.processChannel(channel))
        )
        
        // Only update channels if we have data and component is still mounted
        if (mounted && processedChannels.length > 0) {
          const validChannels = processedChannels.filter(Boolean) as ChannelWithDetails[]
          setChannels(validChannels)
        }

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
            async (payload) => {
              if (!mounted) return;
              
              try {
                if (payload.eventType === 'INSERT') {
                  const processedChannel = await channelProcessor.processChannel(payload.new as Channel)
                  if (processedChannel) {
                    const currentChannels = Array.from(channels.values())
                    setChannels([...currentChannels, processedChannel])
                  }
                } else if (payload.eventType === 'UPDATE') {
                  const processedChannel = await channelProcessor.processChannel(payload.new as Channel)
                  if (processedChannel) {
                    const currentChannels = Array.from(channels.values())
                    const index = currentChannels.findIndex(ch => ch.id === processedChannel.id)
                    if (index !== -1) {
                      currentChannels[index] = processedChannel
                      setChannels(currentChannels)
                    }
                  }
                } else if (payload.eventType === 'DELETE') {
                  const currentChannels = Array.from(channels.values())
                  setChannels(currentChannels.filter(ch => ch.id !== payload.old.id))
                }
              } catch (err) {
                console.error('Error processing channel change:', err)
              }
            }
          )
          .subscribe()

        return () => {
          mounted = false;
          channel.unsubscribe();
        }

      } catch (err) {
        console.error('Failed to load channels:', err)
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load channels'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAndSubscribe();

    return () => {
      mounted = false;
    }
  }, [user])

  const loadChannels = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) {
        setLoading(false)
        return
      }

      // Get all channels and their creators
      const { data, error: loadError } = await supabase
        .from('channels')
        .select(`
          *,
          creator:profiles!channels_created_by_fkey(*),
          members:channel_members(
            user_id,
            role
          )
        `)
        .order('inserted_at', { ascending: false })

      if (loadError) throw loadError

      // Filter channels to only include those where user is a member
      const processedChannels = await Promise.all(
        (data || [])
          .filter(channel => 
            channel.members?.some((member: any) => member.user_id === user.id)
          )
          .map(channel => channelProcessor.processChannel(channel))
      )
      
      // Only update channels if we have data
      if (processedChannels.length > 0) {
        const validChannels = processedChannels.filter(Boolean) as ChannelWithDetails[]
        setChannels(validChannels)
      }

    } catch (err) {
      console.error('Failed to load channels:', err)
      setError(err instanceof Error ? err : new Error('Failed to load channels'))
    } finally {
      setLoading(false)
    }
  }

  interface CreateChannelParams {
    slug: string
  }

  const createChannel = async ({ slug }: CreateChannelParams) => {
    try {
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
        const processedChannel = await channelProcessor.processChannel(data)
        if (processedChannel) {
          const currentChannels = Array.from(channels.values())
          const index = currentChannels.findIndex(ch => ch.id === channelId)
          if (index !== -1) {
            currentChannels[index] = processedChannel
            setChannels(currentChannels)
          }
        }
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

      const currentChannels = Array.from(channels.values())
      setChannels(currentChannels.filter(ch => ch.id !== channelId))

    } catch (err) {
      console.error('Failed to delete channel:', err)
      throw err instanceof Error ? err : new Error('Failed to delete channel')
    }
  }

  const deleteAllChannels = async () => {
    try {
      if (!user) throw new Error('No authenticated user')

      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('created_by', user.id)

      if (error) throw error
      
      const currentChannels = Array.from(channels.values())
      setChannels(currentChannels.filter(ch => ch.created_by !== user.id))

    } catch (err) {
      console.error('Failed to delete all channels:', err)
      throw err instanceof Error ? err : new Error('Failed to delete all channels')
    }
  }

  return {
    channels,
    loading,
    error,
    createChannel,
    updateChannel,
    deleteChannel,
    deleteAllChannels,
    refresh: loadChannels
  }
} 