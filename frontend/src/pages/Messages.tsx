import { useState, useEffect } from 'react'
import { useChannels, Channel } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { supabase } from '../lib/supabaseClient'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string
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
    deleteChannel,
    joinChannel
  } = useChannels()
  const {
    channels: dmChannels,
    isLoading: dmsLoading,
    error: dmsError,
    // Used in handleCreateDM
    createDirectMessage
  } = useDirectMessages()

  const handleCreateChannel = async () => {
    const name = prompt('Enter channel name:')
    if (name) {
      try {
        await createChannel({
          name,
          description: `Channel: ${name}`,
          is_private: false
        })
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
      // Don't set currentChat until we have a channel ID
      const channelId = await createDirectMessage(username)
      
      // Get the username for display
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (profileError || !profile) {
        throw new Error('Could not find user profile')
      }

      // Now set the current chat with the channel ID and username
      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: profile.username
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

  const getOtherMember = async (members: any[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    return members.find(m => m.user_id !== user?.id)?.profile
  }

  const handleChannelClick = async (channel: Channel) => {
    try {
      // Check if we're already a member
      const { data: membership, error: membershipError } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channel.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      // Only try to join if we're not already a member and it's a public channel
      if (!membership && !membershipError && !channel.is_private) {
        await joinChannel(channel.id)
      }
      
      setCurrentChat({
        type: 'channel',
        id: channel.id,
        name: channel.name
      })
    } catch (err) {
      console.error('Failed to join channel:', err)
      alert('Failed to join channel')
    }
  }

  useEffect(() => {
    // Load DM usernames
    dmChannels.forEach(async (dm) => {
      const profile = await getOtherMember(dm.members)
      if (profile) {
        setDmUsernames(prev => ({
          ...prev,
          [dm.id]: profile.username || 'Unknown User'
        }))
      }
    })
  }, [dmChannels, getOtherMember])

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
                    # {channel.name}
                  </button>
                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="hidden group-hover:block px-2 py-1 text-red-500 hover:text-red-700 bg-indigo-50 hover:bg-indigo-100 rounded-r"
                  >
                    ×
                  </button>
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
            Select a channel or conversation to start messaging
          </div>
        )}
      </div>
    </div>
  )
} 