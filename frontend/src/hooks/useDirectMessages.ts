import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { User } from '../types/models'
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
            const processed = processor.processDirectMessage(payload.new)
            if (processed) {
              addMessage(processed.channelId, processed)
            }
          } else if (payload.eventType === 'UPDATE') {
            const processed = processor.processDirectMessage({
              ...payload.new,
              eventType: 'UPDATE'
            })
            if (processed) {
              updateMessage(processed.channelId, processed.id, processed)
            }
          } else if (payload.eventType === 'DELETE') {
            removeMessage(payload.old.channel_id, payload.old.id)
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
      setLoading(true);
      setError(null);

      if (!user) {
        console.log('No user found, clearing conversations');
        setConversationMessages(new Map());
        return;
      }

      // Get all DM channels with their members
      const { data: userChannels } = await supabase
        .from('direct_message_members')
        .select('channel_id')
        .eq('user_id', user.id);

      const channelIds = userChannels?.map(uc => uc.channel_id) || [];

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
            profile:profiles!direct_message_members_profile_id_fkey(
              id,
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .order('updated_at', { ascending: false })
        .in('id', channelIds);

      console.log('Fetched DM channels:', {
        channelsCount: channels?.length || 0,
        channelIds,
        error: channelsError?.message,
        firstChannelMembers: channels?.[0]?.members
      });

      if (channelsError) {
        console.error('Failed to load DM channels:', channelsError);
        throw channelsError;
      }

      if (!channels || channels.length === 0) {
        console.log('No channels found, clearing conversations');
        setConversationMessages(new Map());
        return;
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
          profile:profiles!direct_messages_profile_id_fkey(
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .in('channel_id', channels.map(c => c.id))
        .order('created_at', { ascending: true });

      console.log('Fetched messages:', {
        messagesCount: messages?.length || 0,
        error: messagesError?.message
      });

      if (messagesError) {
        console.error('Failed to load messages:', messagesError);
        throw messagesError;
      }

      // Process and group messages by channel
      const channelMap = new Map();
      channels.forEach(channel => {
        // Find the other member (not the current user)
        const otherMember = channel.members.find(m => m.user_id !== user.id);
        if (!otherMember) {
          console.log('No other member found for channel:', channel.id);
          return;
        }

        // Get the other user's profile from the members array
        const otherUserProfile = channel.members.find(m => m.user_id === otherMember.user_id)?.profile;
        if (!otherUserProfile) {
          console.log('No profile found for other member:', otherMember.user_id);
          return;
        }

        const channelMessages = messages
          ? messages.filter(m => m.channel_id === channel.id).map(m => ({
              ...m,
              sender: m.profile,
              receiver: otherUserProfile // Use the other user's profile as receiver
            }))
          : [];

        channelMap.set(otherMember.user_id, {
          messages: channelMessages,
          otherUserId: otherMember.user_id,
          otherUserProfile, // Add the other user's profile
          channelId: channel.id,
          members: channel.members.map(m => ({
            user_id: m.user_id,
            profile: m.profile
          }))
        });
      });

      console.log('Processed channels:', {
        channelMapSize: channelMap.size,
        channelIds: Array.from(channelMap.values()).map(c => c.channelId),
        firstChannel: channelMap.size > 0 ? {
          ...Array.from(channelMap.values())[0],
          messages: Array.from(channelMap.values())[0].messages.length + ' messages'
        } : null
      });

      // Set the conversations map directly
      setConversationMessages(channelMap);

    } catch (err) {
      console.error('Failed to load DM channels:', err);
      setError(err instanceof Error ? err : new Error('Failed to load DM channels'));
    } finally {
      setLoading(false);
    }
  };

  const createDirectMessage = async (otherUsername: string) => {
    try {
      if (!user) throw new Error('No authenticated user');

      // Get current user's profile first
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .single();

      console.log('Current user profile:', { userId: user.id, currentProfile, profileError });

      if (profileError || !currentProfile) {
        throw new Error(profileError?.message || 'Could not fetch current user profile');
      }

      // Prevent self-DMs
      if (otherUsername === currentProfile.username) {
        throw new Error('Cannot create a direct message channel with yourself');
      }

      // Get the other user's profile from their username
      const { data: otherProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', otherUsername)
        .single();

      console.log('Other user profile:', { otherUsername, otherProfile, userError });

      if (userError || !otherProfile) {
        throw new Error(userError?.message || `User "${otherUsername}" not found`);
      }

      // Double-check to prevent self-DMs (in case of case-sensitivity issues)
      if (currentProfile.id === otherProfile.id) {
        throw new Error('Cannot create a direct message channel with yourself');
      }

      console.log('Creating DM channel between users:', {
        currentUser: { id: user.id, profile: currentProfile },
        otherUser: { id: otherProfile.id, profile: otherProfile }
      });

      // Create a new channel using RPC function
      const { data: newChannel, error: createError } = await supabase
        .rpc('find_or_create_dm_channel', {
          p_user_id: user.id,
          p_other_user_id: otherProfile.id
        });

      console.log('RPC result:', { newChannel, createError });

      if (createError) {
        throw new Error(`Error creating DM channel: ${createError.message}`);
      }

      // Refresh the channels list
      await loadChannels();

      return newChannel.channel_id;

    } catch (error) {
      console.error('Error in createDirectMessage:', error);
      throw error;
    }
  };

  return {
    conversations,
    loading,
    error,
    refresh: loadChannels,
    createDirectMessage
  }
} 