import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MessageList } from './MessageList'
import { supabase } from '../lib/supabaseClient'

export function TestMessaging() {
  const { user } = useAuth()
  const [channelId, setChannelId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Create a test channel on component mount
  useEffect(() => {
    if (!user) return

    const createTestChannel = async () => {
      try {
        // First check if we already have a test channel
        const { data: existingChannels, error: searchError } = await supabase
          .from('channels')
          .select('*')
          .eq('slug', 'test-channel')
          .eq('created_by', user.id)
          .limit(1)

        if (searchError) throw searchError

        let channel = existingChannels?.[0]

        if (!channel) {
          // Create new channel
          const { data: newChannel, error: channelError } = await supabase
            .from('channels')
            .insert({
              slug: 'test-channel',
              created_by: user.id
            })
            .select()
            .single()

          if (channelError) throw channelError
          console.log('✅ Created test channel:', newChannel)
          channel = newChannel
        } else {
          console.log('✅ Found existing test channel:', channel)
        }

        setChannelId(channel.id)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create test channel')
        console.error('❌ Error:', err)
      }
    }

    createTestChannel()

    // Cleanup function
    return () => {
      setChannelId(null)
    }
  }, [user])

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    )
  }

  if (!channelId) {
    return (
      <div className="p-4">
        Creating test channel...
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <h1 className="text-lg font-semibold">Test Channel</h1>
          <p className="text-sm text-gray-500">
            Try these features:
          </p>
          <ul className="text-sm text-gray-500 list-disc list-inside">
            <li>Send a message with markdown: *bold*, _italic_, `code`, [link](url)</li>
            <li>Hover over a message to edit (your messages)</li>
            <li>Send multiple messages to test history loading</li>
            <li>Test real-time updates in another browser window</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <MessageList channelId={channelId} />
      </div>
    </div>
  )
} 