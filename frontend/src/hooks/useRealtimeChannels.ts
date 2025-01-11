import { useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useChannelStore } from '../stores/channelStore';
import { useAuth } from './useAuth';
import { Channel } from '../types/models';
import { getChannelProcessor, ChannelWithDetails } from '../utils/ChannelProcessor';
import { useUserStore } from '../stores/userStore';

interface UseRealtimeChannelsProps {
  type?: 'public' | 'private';
}

export function useRealtimeChannels({ type }: UseRealtimeChannelsProps = {}) {
  const { user } = useAuth();
  const {
    channels: storeChannels,
    optimisticChannels,
    addChannel,
    updateChannel,
    removeChannel,
    setChannels,
    setLoading,
    setError
  } = useChannelStore();

  const { users } = useUserStore();

  // Create channel processor
  const channelProcessor = useMemo(() => {
    return getChannelProcessor({
      getUserById: (id: string) => users.get(id)
    });
  }, [users]);

  // Process and add new channel
  const processChannel = useCallback((newChannel: Channel) => {
    const processed = channelProcessor.processChannel(newChannel);
    if (processed) {
      addChannel(processed);
    }
  }, [channelProcessor, addChannel]);

  // Load initial channels
  useEffect(() => {
    if (!user) return;

    const loadChannels = async () => {
      setLoading(true);
      try {
        const query = supabase
          .from('channels')
          .select(`
            *,
            creator:profiles!channels_created_by_fkey(*)
          `)
          .order('created_at', { ascending: false });

        // Add type filter if specified
        if (type) {
          query.eq('type', type);
        }

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        if (data) {
          const processed = channelProcessor.processChannels(data);
          setChannels(processed);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load channels');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
  }, [user, type, channelProcessor, setChannels, setLoading, setError]);

  // Subscribe to channel changes
  useEffect(() => {
    if (!user) return;

    // Clear processed channels when subscribing
    channelProcessor.clearProcessedIds();

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
          if (payload.eventType === 'INSERT' && !channelProcessor.hasProcessed(payload.new.id)) {
            processChannel(payload.new as Channel);
          } else if (payload.eventType === 'UPDATE') {
            const processed = channelProcessor.processChannel({
              ...payload.new as Channel,
              eventType: 'UPDATE'
            });
            if (processed) {
              updateChannel(processed.id, processed);
            }
          } else if (payload.eventType === 'DELETE') {
            removeChannel(payload.old.id);
          }
        }
      )
      .subscribe();

    return () => {
      channelProcessor.clearProcessedIds();
      supabase.removeChannel(channel);
    };
  }, [user, channelProcessor, processChannel, updateChannel, removeChannel]);

  // Memoize channels array from store
  const channels = useMemo(() => {
    const allChannels = Array.from(storeChannels.values());
    const optimistic = Array.from(optimisticChannels.values());
    return [...allChannels, ...optimistic].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [storeChannels, optimisticChannels]);

  // Create channel
  const createChannel = useCallback(async (data: { slug: string; type?: 'public' | 'private' }) => {
    if (!user) throw new Error('No authenticated user');

    const optimisticId = `temp-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const optimisticChannel: ChannelWithDetails = {
      id: optimisticId,
      slug: data.slug,
      type: data.type || 'public',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: user.id,
      creator: user
    };

    // Add optimistic channel
    addChannel(optimisticChannel);

    try {
      const { data: newChannel, error } = await supabase
        .from('channels')
        .insert({
          slug: data.slug,
          type: data.type || 'public',
          created_by: user.id
        })
        .select(`
          *,
          creator:profiles!channels_created_by_fkey(*)
        `)
        .single();

      if (error) throw error;

      // Process and add the real channel
      if (newChannel) {
        const processed = channelProcessor.processChannel(newChannel);
        if (processed) {
          addChannel(processed);
        }
      }

      return newChannel;
    } catch (err) {
      // Remove optimistic channel on error
      removeChannel(optimisticId);
      throw err;
    }
  }, [user, channelProcessor, addChannel, removeChannel]);

  return {
    channels,
    createChannel
  };
} 