import { useState, useEffect } from 'react'
import { useChannels } from '../hooks/useChannels'
import { useDirectMessages } from '../hooks/useDirectMessages'
import { MessageList } from '../components/MessageList'
import { supabase } from '../lib/supabaseClient'

type ChatType = 'channel' | 'dm'

interface ChatTarget {
  type: ChatType
  id: string
  name: string
}

export function Chat() {
  const [currentChat, setCurrentChat] = useState<ChatTarget | null>(null)
  const [dmUsernames, setDmUsernames] = useState<Record<string, string>>({})
  const { channels, isLoading: channelsLoading, error: channelsError } = useChannels()
  const { 
    channels: dmChannels, 
    isLoading: dmsLoading, 
    error: dmsError,
    // @ts-ignore
    createDirectMessage
  } = useDirectMessages()

  const getOtherMember = async (members: any[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    return members.find(m => m.user_id !== user?.id)?.profile
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
  }, [dmChannels])

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        {/* Channels Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-600">Channels</h2>
            <button
              onClick={() => {/* TODO: Open create channel modal */}}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              + New
            </button>
          </div>
          {channelsLoading ? (
            <div className="text-sm text-gray-500">Loading channels...</div>
          ) : channelsError ? (
            <div className="text-sm text-red-500">Error loading channels</div>
          ) : (
            <div className="space-y-1">
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setCurrentChat({
                    type: 'channel',
                    id: channel.id,
                    name: channel.name
                  })}
                  className={`w-full text-left px-2 py-1 rounded text-sm ${
                    currentChat?.id === channel.id
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  # {channel.name}
                  {channel.member_count && (
                    <span className="ml-2 text-xs text-gray-500">
                      {channel.member_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-600">Direct Messages</h2>
            <button
              onClick={() => {/* TODO: Open user search modal */}}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              + New
            </button>
          </div>
          {dmsLoading ? (
            <div className="text-sm text-gray-500">Loading messages...</div>
          ) : dmsError ? (
            <div className="text-sm text-red-500">Error loading messages</div>
          ) : (
            <div className="space-y-1">
              {dmChannels.map(dm => {
                return (
                  <button
                    key={dm.id}
                    onClick={() => setCurrentChat({
                      type: 'dm',
                      id: dm.id,
                      name: dmUsernames[dm.id] || 'Unknown User'
                    })}
                    className={`w-full text-left px-2 py-1 rounded text-sm ${
                      currentChat?.id === dm.id
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {dmUsernames[dm.id] || 'Unknown User'}
                      </span>
                      {dm.unread_count ? (
                        <span className="bg-indigo-500 text-white text-xs px-1.5 rounded-full">
                          {dm.unread_count}
                        </span>
                      ) : null}
                    </div>
                    {dm.last_message && (
                      <div className="text-xs text-gray-500 truncate">
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
      <div className="flex-1">
        {currentChat ? (
          <div className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="bg-white border-b px-6 py-3">
              <h1 className="text-lg font-semibold">
                {currentChat.type === 'channel' ? '#' : ''} {currentChat.name}
              </h1>
            </div>
            {/* Messages */}
            <MessageList channelId={currentChat.id} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a channel or conversation to start chatting
          </div>
        )}
      </div>
    </div>
  )
} 