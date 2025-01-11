import { useState, useEffect } from 'react'
import { useChannels } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { supabase } from '../lib/supabaseClient'
import { Channel, User } from '../types/schema'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string  // All IDs are now UUIDs
  name: string
}

export function Messages() {
  const [currentChat, setCurrentChat] = useState<ChatTarget | null>(null)
  const [dmUsernames, setDmUsernames] = useState<Record<string, string>>({})
  const { 
    channels, 
    isLoading: channelsLoading, 
    error: channelsError, 
    createChannel,
    deleteChannel
  } = useChannels()
  const {
    channels: dmChannels,
    isLoading: dmsLoading,
    error: dmsError,
    createDirectMessage
  } = useDirectMessages()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])

  const handleCreateChannel = async () => {
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
    const username = prompt('Enter username to message:')
    if (!username) return
    
    try {
      const channelId = await createDirectMessage(username)
      
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('username', username)
        .single()

      if (userError || !user) {
        throw new Error('Could not find user')
      }

      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: user.username || user.full_name || 'Unknown User'
      })
    } catch (err) {
      console.error('Failed to create DM:', err)
      alert(err instanceof Error ? err.message : 'Failed to create DM')
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
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

  const getOtherUser = async (members: { user: User }[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    return members.find(m => m.user.id !== user?.id)?.user
  }

  const handleChannelClick = async (channel: Channel) => {
    try {
      // Check if user is already a member
      const { data: membership, error: membershipError } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channel.id)
        .eq('user_id', currentUserId)
        .single()

      if (membershipError && membershipError.code !== 'PGRST116') {
        console.error('Error checking channel membership:', membershipError)
        throw membershipError
      }

      // If not a member and channel is public, join it
      if (!membership) {
        const { error: joinError } = await supabase
          .from('channel_members')
          .insert({
            channel_id: channel.id,
            user_id: currentUserId,
            profile_id: currentUserId,  // Add profile_id
            role: 'member'
          })

        if (joinError) {
          console.error('Error joining channel:', joinError)
          throw joinError
        }

        console.log('Successfully joined channel')
      }

      setCurrentChat({
        type: 'channel',
        id: channel.id,
        name: channel.slug
      })
    } catch (err) {
      console.error('Failed to handle channel click:', err)
      alert('Failed to join channel. Please try again.')
    }
  }

  useEffect(() => {
    // Load DM usernames
    dmChannels.forEach(async (dm) => {
      const otherUser = await getOtherUser(dm.members)
      if (otherUser) {
        setDmUsernames(prev => ({
          ...prev,
          [dm.id]: otherUser.username || otherUser.full_name || 'Unknown User'
        }))
      }
    })
  }, [dmChannels])

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
              {channels.map(channel => (
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
                  {currentUserId && channel.created_by === currentUserId && (
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
          ) : (
            <div className="space-y-2">
              {dmChannels.map(dm => (
                <button
                  key={dm.id}
                  onClick={() => setCurrentChat({
                    type: 'dm',
                    id: dm.id,
                    name: dmUsernames[dm.id] || 'Loading...'
                  })}
                  className={`w-full text-left px-2 py-1 rounded text-black bg-indigo-50 hover:bg-indigo-100 ${
                    currentChat?.id === dm.id
                      ? 'bg-indigo-100'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-black">{dmUsernames[dm.id] || 'Loading...'}</span>
                    {(dm.unread_count ?? 0) > 0 && (
                      <span className="bg-indigo-500 text-white text-xs px-1.5 rounded-full">
                        {dm.unread_count}
                      </span>
                    )}
                  </div>
                  {dm.last_message && (
                    <div className="text-xs text-gray-600 truncate">
                      {dm.last_message.content}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentChat ? (
          <div className="h-full flex flex-col">
            <div className="bg-white border-b px-6 py-3">
              <h1 className="text-lg font-semibold">
                {currentChat.type === 'channel' ? '#' : ''} {currentChat.name}
              </h1>
            </div>
            <div className="flex-1 overflow-hidden">
              <MessageList 
                channelId={currentChat.id}
                chatType={currentChat.type}
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