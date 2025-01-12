import { useState, useEffect, useCallback } from 'react'
import { useChannels } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { Channel, User } from '../types/models'
import { useAuth } from '../hooks/useAuth'
import { useUserCache } from '../hooks/useUserCache'
import { supabase } from '../lib/supabaseClient'
import { useStatusStore } from '../stores/statusStore'
import { UserPresence } from '../components/UserPresence'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string  // All IDs are now UUIDs
  name: string
}

export default function Messages() {
  const [currentChat, setCurrentChat] = useState<ChatTarget | null>(null)
  const { user: currentUser } = useAuth()
  const { getUser } = useUserCache()
  const { getUserProfile } = useStatusStore()
  const { 
    channels, 
    isLoading: channelsLoading, 
    error: channelsError, 
    createChannel,
    deleteChannel
  } = useChannels()
  const {
    conversations: dmChannels,
    loading: dmsLoading,
    error: dmsError,
    createDirectMessage,
    refresh: refreshDirectMessages
  } = useDirectMessages()

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
        await createChannel({ slug })
      } catch (err) {
        console.error('Failed to create channel:', err)
        alert('Failed to create channel')
      }
    }
  }

  const handleCreateDM = async () => {
    if (!currentUser) {
      alert('Please sign in to send direct messages')
      return
    }
    const username = prompt('Enter username to message:')
    if (!username) return
    
    try {
      // First check if user exists
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', username)
        .single()

      if (userError || !userProfile) {
        alert(`User "${username}" not found. Please check the username and try again.`)
        return
      }

      const channelId = await createDirectMessage(username)
      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: userProfile.username || userProfile.full_name || 'Unknown User'
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
    if (confirm('Are you sure you want to delete this channel?')) {
      try {
        await deleteChannel(channelId)
        if (currentChat?.id === channelId) {
          setCurrentChat(null)
        }
      } catch (err) {
        console.error('Failed to delete channel:', err)
        alert('Failed to delete channel')
      }
    }
  }

  const handleChannelClick = async (channel: Channel) => {
    if (!currentUser) {
      alert('Please sign in to view channels')
      return
    }

    try {
      // Check if user is already a member
      const { data: existingMembership, error: membershipError } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('user_id', currentUser.id)
        .single()

      if (membershipError && !existingMembership) {
        // User is not a member, try to join the channel
        const { error: joinError } = await supabase
          .from('channel_members')
          .insert({
            channel_id: channel.id,
            user_id: currentUser.id,
            profile_id: currentUser.id,
            role: 'member'
          })

        if (joinError) {
          console.error('Failed to join channel:', joinError)
          alert('Failed to join channel')
          return
        }
      }

      setCurrentChat({
        type: 'channel',
        id: channel.id,
        name: channel.slug
      })
    } catch (err) {
      console.error('Error accessing channel:', err)
      alert('Error accessing channel')
    }
  }

  return (
    <div className="flex h-full">
      {/* Channels List */}
      <div className="w-64 bg-gray-50 border-r p-4">
        {/* Channels Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-black">Channels</h2>
            <button
              onClick={handleCreateChannel}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              + New
            </button>
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
            <button
              onClick={handleCreateDM}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              + New
            </button>
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
                        {(dm.unread_count ?? 0) > 0 && (
                          <span className="bg-indigo-500 text-white text-xs px-1.5 rounded-full">
                            {dm.unread_count}
                          </span>
                        )}
                      </div>
                      {dm.messages?.[0] && (
                        <div className="text-xs text-gray-600 truncate">
                          {dm.messages[0].content}
                        </div>
                      )}
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentChat ? (
          <div className="h-full flex flex-col">
            <div className="bg-white border-b px-6 py-3">
              <h1 className="text-lg font-semibold text-black">
                {currentChat.type === 'channel' ? '#' : ''} {currentChat.name}
              </h1>
            </div>
            <div className="flex-1 overflow-hidden">
              <MessageList 
                channelId={currentChat.id}
                chatType={currentChat.type}
                key={`${currentChat.type}-${currentChat.id}`}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a channel or direct message to start chatting
          </div>
        )}
      </div>
    </div>
  )
} 