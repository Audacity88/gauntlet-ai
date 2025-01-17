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

// Helper function to safely convert dmChannels to array
const getDMChannelsArray = (dmChannels: any) => {
  if (!dmChannels) {
    return [];
  }
  
  if (dmChannels instanceof Map) {
    return Array.from(dmChannels.entries());
  }
  
  console.warn('dmChannels is neither null/undefined nor a Map:', typeof dmChannels);
  return [];
};

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

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentUser) return

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
        async () => {
          await refreshChannels()
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
        async () => {
          await refreshChannels()
        }
      )
      .subscribe()

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
        async () => {
          await refreshDirectMessages()
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
        async () => {
          await refreshDirectMessages()
        }
      )
      .subscribe()

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
        async () => {
          getUserProfile(currentUser.id)
        }
      )
      .subscribe()

    return () => {
      channelChanges.unsubscribe()
      dmChanges.unsubscribe()
      statusChanges.unsubscribe()
    }
  }, [currentUser, refreshChannels, refreshDirectMessages, getUserProfile])

  useEffect(() => {
    if (currentChat) {
      invalidateChannelMessages(currentChat.id)
    }
  }, [currentChat, invalidateChannelMessages])

  const getOtherUser = useCallback((members: { user_id: string; profile: User }[] | undefined) => {
    if (!currentUser || !members || !Array.isArray(members)) return null;
    const otherMember = members.find(m => m.user_id !== currentUser.id);
    return otherMember?.profile;
  }, [currentUser]);

  const handleCreateChannel = async () => {
    if (!currentUser) {
      alert('Please sign in to create a channel')
      return
    }
    const slug = prompt('Enter channel name:')
    if (slug) {
      try {
        const channel = await createChannel({ slug })
        
        if (channel) {
          // Add creator as channel member
          const { error: memberError } = await supabase
            .from('channel_members')
            .insert({
              channel_id: channel.id,
              user_id: currentUser.id,
              profile_id: currentUser.id
            })

          if (memberError) {
            // Continue anyway as the channel was created
          }

          setCurrentChat({
            type: 'channel',
            id: channel.id,
            name: channel.slug
          })
        }
      } catch (err) {
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
      const channelId = await createDirectMessage(selectedUser.username)
      
      // Set the display name consistently using full name first
      const displayName = selectedUser.full_name || selectedUser.username || 'Unknown User';
      
      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: displayName
      })
    } catch (err) {
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

    if (!channel) {
      alert('Channel not found. The page may be out of date - please refresh.')
      return
    }

    if (confirm('Are you sure you want to delete this channel?')) {
      try {
        await deleteChannel(channelId)
        if (currentChat?.id === channelId) {
          setCurrentChat(null)
        }
      } catch (err) {
        alert('Failed to delete channel')
      }
    }
  }

  const handleChannelClick = useCallback(async (channel: Channel) => {
    if (!currentUser) return

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
            user_id: currentUser.id,
            profile_id: currentUser.id
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
      console.error('Error joining channel:', error)
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
              {(() => {
                // console.log('Rendering DM channels:', {
                //   dmChannelsSize: dmChannels.size,
                //   isMap: dmChannels instanceof Map,
                //   entries: getDMChannelsArray(dmChannels).map(([userId, dm]) => ({
                //     userId,
                //     channelId: dm.channelId,
                //     hasMembers: Boolean(dm.members),
                //     memberCount: dm.members?.length
                //   }))
                // });

                return getDMChannelsArray(dmChannels)
                  .filter(([_, dm]) => {
                    const isValid = dm && dm.channelId && dm.members;
                    if (!isValid) {
                      console.log('Filtered out DM:', {
                        hasData: Boolean(dm),
                        hasChannelId: Boolean(dm?.channelId),
                        hasMembers: Boolean(dm?.members)
                      });
                    }
                    return isValid;
                  })
                  .map(([userId, dm]) => {
                    // Find the other member's profile
                    const otherMember = dm.members.find((m: { user_id: string; profile: User }) => {
                      // Check if this member is NOT the current user by comparing email/username
                      const isCurrentUser = m.profile.username === currentUser?.email;
                      return !isCurrentUser;
                    });
                    
                    const otherUserProfile = otherMember?.profile;
                    
                    console.log('DM member profiles:', {
                      channelId: dm.channelId,
                      currentUserEmail: currentUser?.email,
                      members: dm.members.map((m: { user_id: string; profile: User }) => ({
                        userId: m.user_id,
                        username: m.profile?.username,
                        fullName: m.profile?.full_name,
                        isCurrentUser: m.profile.username === currentUser?.email
                      }))
                    });

                    const displayName = otherUserProfile?.full_name || otherUserProfile?.username || 'Unknown User';
                    
                    return (
                      <button
                        key={dm.channelId}
                        onClick={() => setCurrentChat({
                          type: 'dm',
                          id: dm.channelId,
                          name: displayName
                        })}
                        className={`w-full text-left px-2 py-1 rounded text-black bg-indigo-50 hover:bg-indigo-100 ${
                          currentChat?.id === dm.channelId
                            ? 'bg-indigo-100'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-black">{displayName}</span>
                            {otherUserProfile && <UserPresence userId={otherUserProfile.id} size="sm" />}
                          </div>
                        </div>
                      </button>
                    );
                  });
              })()}
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