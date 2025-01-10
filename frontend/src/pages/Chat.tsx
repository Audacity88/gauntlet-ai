import { useState, useEffect } from 'react'
import { useChannels } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { supabase } from '../lib/supabaseClient'
import { User } from '../types/schema'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string  // All IDs are now UUIDs
  name: string
}

export function Chat() {
  const [currentChat, setCurrentChat] = useState<ChatTarget | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
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
    createDirectMessage,
    markChannelAsRead
  } = useDirectMessages()

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
        .select('username')
        .eq('username', username)
        .single()

      if (userError || !user) {
        throw new Error('Could not find user')
      }

      setCurrentChat({
        type: 'dm',
        id: channelId,
        name: user.username || 'Unknown User'
      })
    } catch (err) {
      console.error('Failed to create DM:', err)
      alert(err instanceof Error ? err.message : 'Failed to create DM')
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return
    
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white p-4 border-r border-gray-200">
        {/* Channels Section */}
        <div className="mb-8">
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
                <div key={channel.id} className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentChat({
                      type: 'channel',
                      id: channel.id,
                      name: channel.slug
                    })}
                    className={`flex-grow text-left px-2 py-1 rounded text-black hover:bg-indigo-50 ${
                      currentChat?.id === channel.id ? 'bg-indigo-100' : ''
                    }`}
                  >
                    # {channel.slug}
                  </button>
                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="ml-2 text-red-500 hover:text-red-700"
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
              {dmChannels.map(dm => {
                const otherMember = dm.members.find(m => m.user.id !== currentUserId)
                return (
                  <button
                    key={dm.id}
                    onClick={() => setCurrentChat({
                      type: 'dm',
                      id: dm.id,
                      name: otherMember?.user.username || 'Unknown User'
                    })}
                    className={`w-full text-left px-2 py-1 rounded text-black hover:bg-indigo-50 ${
                      currentChat?.id === dm.id ? 'bg-indigo-100' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{otherMember?.user.username || 'Unknown User'}</span>
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
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            <div className="bg-white border-b border-gray-200 px-4 py-2">
              <h1 className="text-xl font-bold text-black">
                {currentChat.type === 'channel' ? '#' : ''} {currentChat.name}
              </h1>
            </div>
            <div className="flex-1 overflow-hidden">
              <MessageList 
                channelId={currentChat.id} 
                chatType={currentChat.type}
                markChannelAsRead={currentChat.type === 'dm' ? markChannelAsRead : undefined}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel or message to start chatting
          </div>
        )}
      </div>
    </div>
  )
} 