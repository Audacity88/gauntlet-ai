import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { Channel } from '../types/schema'

interface CreateChannelParams {
  slug: string
}

export function useChannels() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [channels, setChannels] = useState<Map<string, Channel>>(new Map())
    
  const loadAndSubscribe = useCallback(async () => {
    if (!user) {
      console.log('No user, skipping channel load')
      return
    }

    setLoading(true)
    try {
      console.log('Loading channels for user:', user.id)
      
      // Get all channels that still exist in the database
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .select(`
          id,
          slug,
          created_by,
          inserted_at
        `)
        .order('inserted_at', { ascending: false })

      if (channelError) {
        console.error('Error loading channels:', channelError)
        setError(channelError)
        return
      }

      // Clear the existing channels and add only those that exist
      const newChannels = new Map<string, Channel>()
      channelData?.forEach(channel => {
        newChannels.set(channel.id, channel)
      })

      console.log('Loaded channels:', Array.from(newChannels.values()))
      setChannels(newChannels)
      setError(null)

    } catch (err) {
      console.error('Error in loadAndSubscribe:', err)
      setError(err instanceof Error ? err : new Error('Failed to load channels'))
    } finally {
      setLoading(false)
    }
  }, [user])

  // Set up initial load and subscription
  useEffect(() => {
    loadAndSubscribe()
  }, [loadAndSubscribe])

  const refresh = useCallback(() => {
    loadAndSubscribe()
  }, [loadAndSubscribe])

  const createChannel = useCallback(async ({ slug }: CreateChannelParams) => {
    if (!user) {
      throw new Error('User must be signed in to create channels')
    }

    const { data: channel, error: createError } = await supabase
      .from('channels')
      .insert({
        slug,
        created_by: user.id
      })
      .select()
      .single()

    if (createError) {
      throw createError
    }

    return channel
  }, [user])

  const deleteChannel = useCallback(async (channelId: string) => {
    if (!user) {
      throw new Error('User must be signed in to delete channels')
    }

    try {
      // First check if the channel exists and if the user is the creator
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('id, created_by')
        .eq('id', channelId)
        .maybeSingle()

      if (channelError) {
        console.error('Error checking channel:', channelError)
        throw channelError
      }

      if (!channel) {
        throw new Error('Channel not found')
      }

      if (channel.created_by !== user.id) {
        throw new Error('Only the channel creator can delete the channel')
      }

      // Delete the channel (this will cascade to members and messages)
      const { error: deleteError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId)

      if (deleteError) {
        console.error('Error deleting channel:', deleteError)
        throw deleteError
      }

      // Remove from local state
      const newChannels = new Map(channels)
      newChannels.delete(channelId)
      setChannels(newChannels)

    } catch (err) {
      console.error('Error in deleteChannel:', err)
      throw err
    }
  }, [user, channels])

  return {
    channels,
    loading,
    error,
    refresh,
    createChannel,
    deleteChannel
  }
} 