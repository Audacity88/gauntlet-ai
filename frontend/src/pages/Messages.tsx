import { useState, useEffect, useCallback } from 'react'
import { useChannels } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { User } from '../types/models'
import { Channel } from '../types/schema'
import { useAuth } from '../hooks/useAuth'
import { useUserCache } from '../hooks/useUserCache'
import { supabase } from '../lib/supabaseClient'
import { useStatusStore } from '../stores/statusStore'
import { UserPresence } from '../components/UserPresence'
import { UserList } from '../components/UserList'
import { useMessageCache } from '../hooks/useMessageCache'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string
  name: string
}

export default function Messages() {
  const [currentChat, setCurrentChat] = useState<ChatTarget | null>(null)
  const { user: currentUser } = useAuth()
  const { getUser } = useUserCache()
  const { getUserProfile } = useStatusStore()
  const { invalidateChannelMessages } = useMessageCache()
  
  const { 
    channels, 
    loading: channelsLoading, 
    error: channelsError, 
    createChannel,
    deleteChannel,
    refresh: refreshChannels
  } = useChannels()
  
  const {
    conversations: dmChannels,
    loading: dmsLoading,
    error: dmsError,
    createDirectMessage,
    refresh: refreshDirectMessages
  } = useDirectMessages()

  // Debug logging for state changes
  useEffect(() => {
    console.log('Channels updated:', Array.from(channels.values()))
  }, [channels])

  useEffect(() => {
    console.log('DM channels updated:', Array.from(dmChannels?.values() || []))
  }, [dmChannels])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentUser) {
      console.log('No current user, skipping subscriptions')
      return
    }

    console.log('Setting up real-time subscriptions for user:', currentUser.id)

    // Subscribe to channel changes
    const channelChanges = supabase
      .channel('public:channels:' + currentUser.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        async (payload) => {
          console.log('Channel change received:', {
            event: payload.eventType,
            table: 'channels',
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log('Refreshing channels after change')
          await refreshChannels()
          console.log('Channels refreshed')
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          console.log('Channel member change received:', {
            event: payload.eventType,
            table: 'channel_members',
            data: payload.new || payload.old,
            userId: currentUser.id,
            timestamp: new Date().toISOString()
          })
          
          // If this is a new member addition and it's for the current user
          if (payload.eventType === 'INSERT' && payload.new?.user_id === currentUser.id) {
            console.log('New channel membership detected:', {
              channelId: payload.new.channel_id,
              timestamp: new Date().toISOString()
            })
          }
          
          console.log('Refreshing channels after member change')
          await refreshChannels()
          console.log('Channels refreshed after member change')
        }
      )
      .subscribe((status) => {
        console.log('Channel subscription status:', {
          status,
          timestamp: new Date().toISOString(),
          userId: currentUser.id
        })
      })

    // Subscribe to direct message changes
    const dmChanges = supabase
      .channel('public:dms:' + currentUser.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          console.log('DM sender change received:', {
            event: payload.eventType,
            table: 'direct_messages',
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log('Refreshing DMs after sender change')
          await refreshDirectMessages()
          console.log('DMs refreshed after sender change')
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          console.log('DM receiver change received:', {
            event: payload.eventType,
            table: 'direct_messages',
            data: payload.new || payload.old,
            timestamp: new Date().toISOString()
          })
          console.log('Refreshing DMs after receiver change')
          await refreshDirectMessages()
          console.log('DMs refreshed after receiver change')
        }
      )
      .subscribe((status) => {
        console.log('DM subscription status:', {
          status,
          timestamp: new Date().toISOString(),
          channelId: currentUser.id
        })
      })

    // Subscribe to status changes
    const statusChanges = supabase
      .channel('public:profiles:' + currentUser.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        },
        async (payload) => {
          console.log('Status change received:', payload)
          getUserProfile(currentUser.id)
        }
      )
      .subscribe((status) => {
        console.log('Status subscription status:', status)
      })

    return () => {
      console.log('Cleaning up subscriptions:', {
        timestamp: new Date().toISOString(),
        userId: currentUser.id
      })
      channelChanges.unsubscribe()
      dmChanges.unsubscribe()
      statusChanges.unsubscribe()
    }
  }, [currentUser, refreshChannels, refreshDirectMessages, getUserProfile])

  // Debug logging for chat changes
  useEffect(() => {
    if (currentChat) {
      console.log('Current chat changed:', currentChat)
      invalidateChannelMessages(currentChat.id)
    }
  }, [currentChat, invalidateChannelMessages])

  const getOtherUser = useCallback((members: { user: User }[] | undefined) => {
    if (!currentUser || !members || !Array.isArray(members)) return null
    return members.find(m => m.user.id !== currentUser.id)?.user
  }, [currentUser])

  const handleCreateChannel = async () => {
    if (!currentUser) {
      alert('Please sign in to create a channel')
      return
    }
    const slug = prompt('Enter channel name:')
    if (slug) {
      try {
        console.log('Creating channel:', slug)
        const channel = await createChannel({ slug })
        console.log('Channel created:', channel)
        
        if (channel) {
          // Add creator as channel member
          console.log('Adding creator as channel member')
          const { error: memberError } = await supabase
            .from('channel_members')
            .insert({
              channel_id: channel.id,
              user_id: currentUser.id,
              profile_id: currentUser.id
            })

          if (memberError) {
            console.error('Failed to add creator as member:', memberError)
            // Continue anyway as the channel was created
          } else {
            console.log('Creator added as channel member')
          }

          setCurrentChat({
            type: 'channel',
            id: channel.id,
            name: channel.slug
          })
        }
      } catch (err) {
        console.error('Failed to create channel:', err)
        alert('Failed to create channel')
      }
    }
  }

  const handleCreateDM = async (selectedUser: User) => {
    if (!currentUser) {
      alert('Please sign in to send direct messages')
      return
    }
    
    try {
      console.log('Creating DM with user:', selectedUser)
      const channelId = await createDirectMessage(selectedUser.username)
      console.log('DM channel created:', channelId)
      
      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: selectedUser.username || selectedUser.full_name || 'Unknown User'
      })
    } catch (err) {
      console.error('Failed to create DM:', err)
      alert(err instanceof Error ? err.message : 'Failed to create direct message')
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!currentUser) {
      alert('Please sign in to delete channels')
      return
    }

    // Check if channel exists in current list
    const channel = Array.from(channels.values()).find(ch => ch.id === channelId)
    console.log('Checking channel in current list:', {
      channelId,
      found: !!channel,
      availableChannels: Array.from(channels.values()).map(ch => ({
        id: ch.id,
        slug: ch.slug,
        created_by: ch.created_by
      }))
    })

    if (!channel) {
      console.error('Channel not found in current list:', channelId)
      alert('Channel not found. The page may be out of date - please refresh.')
      return
    }

    if (confirm('Are you sure you want to delete this channel?')) {
      try {
        console.log('Attempting to delete channel:', {
          channelId,
          userId: currentUser.id,
          isCreator: channel.created_by === currentUser.id
        })
        await deleteChannel(channelId)
        console.log('Channel deleted successfully:', channelId)
        if (currentChat?.id === channelId) {
          setCurrentChat(null)
        }
      } catch (err) {
        console.error('Failed to delete channel:', err)
        alert('Failed to delete channel')
      }
    }
  }

  const handleChannelClick = useCallback(async (channel: Channel) => {
    if (!currentUser) {
      console.error('No user found')
      return
    }

    try {
      // Check if user is already a member
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channel.id)
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (memberError) {
        console.error('Error checking channel membership:', memberError)
        alert('Error joining channel. Please try again.')
        return
      }

      // If not a member, join the channel
      if (!memberData) {
        const { error: joinError } = await supabase
          .from('channel_members')
          .insert({
            channel_id: channel.id,
            user_id: currentUser.id
          })

        if (joinError) {
          console.error('Error joining channel:', joinError)
          alert('Error joining channel. Please try again.')
          return
        }
      }

      // Set as current chat
      setCurrentChat({
        type: 'channel',
        id: channel.id,
        name: channel.slug
      })
    } catch (error) {
      console.error('Error in handleChannelClick:', error)
      alert('Error joining channel. Please try again.')
    }
  }, [currentUser, setCurrentChat])

  return (
    <div className="flex h-full">
      {/* Channels List */}
      <div className="w-64 bg-gray-50 border-r p-4">
        {/* Channels Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-black">Channels</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => refreshChannels()}
                className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                aria-label="Reload channels"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                onClick={handleCreateChannel}
                className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                + New
              </button>
            </div>
          </div>

          {channelsLoading ? (
            <div className="text-black">Loading channels...</div>
          ) : channelsError ? (
            <div className="text-red-500">Error: {channelsError.message}</div>
          ) : (
            <div className="space-y-2">
              {Array.from(channels.values()).map(channel => (
                <div 
                  key={channel.id}
                  className="flex items-center justify-between group"
                >
                  <button
                    onClick={() => handleChannelClick(channel)}
                    className={`flex-1 text-left px-2 py-1 rounded text-black bg-indigo-50 hover:bg-indigo-100 ${
                      currentChat?.id === channel.id
                        ? 'bg-indigo-100'
                        : ''
                    }`}
                  >
                    # {channel.slug}
                  </button>
                  {currentUser && channel.created_by === currentUser.id && (
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="hidden group-hover:block px-2 py-1 text-red-500 hover:text-red-700 bg-indigo-50 hover:bg-indigo-100 rounded-r"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-black">Direct Messages</h2>
          </div>

          {dmsLoading ? (
            <div className="text-black">Loading messages...</div>
          ) : dmsError ? (
            <div className="text-red-500">Error: {dmsError.message}</div>
          ) : !dmChannels || dmChannels.size === 0 ? (
            <div className="text-gray-500">No direct messages yet</div>
          ) : (
            <div className="space-y-2">
              {Array.from(dmChannels.values())
                .filter(dm => dm && dm.id && dm.members) // Filter out invalid DMs
                .map(dm => {
                  const otherUser = getOtherUser(dm.members)
                  const displayName = otherUser?.username || 'Unknown User'
                  
                  return (
                    <button
                      key={dm.id}
                      onClick={() => setCurrentChat({
                        type: 'dm',
                        id: dm.id,
                        name: displayName
                      })}
                      className={`w-full text-left px-2 py-1 rounded text-black bg-indigo-50 hover:bg-indigo-100 ${
                        currentChat?.id === dm.id
                          ? 'bg-indigo-100'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-black">{displayName}</span>
                          {otherUser && <UserPresence userId={otherUser.id} size="sm" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </div>

        {/* User List Section */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-black mb-4">All Users</h2>
          <UserList
            onUserSelect={handleCreateDM}
            showPresence={true}
            filter="all"
          />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 h-full">
        {currentChat ? (
          <MessageList
            channelId={currentChat.id}
            chatType={currentChat.type}
            chatName={currentChat.name}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a channel or direct message to start chatting
          </div>
        )}
      </div>
    </div>
  )
} 