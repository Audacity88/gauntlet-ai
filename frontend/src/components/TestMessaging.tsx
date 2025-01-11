import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MessageList } from './MessageList'
import { useChannelStore } from '../stores/channelStore'
import { getChannelProcessor } from '../utils/ChannelProcessor'
import type { Channel } from '../types/models'

export function TestMessaging() {
  const { user } = useAuth()
  const [channelId, setChannelId] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const { channels, setChannels, createChannel } = useChannelStore()
  const channelProcessor = getChannelProcessor()

  // Create a test channel on component mount
  useEffect(() => {
    if (!user) return

    const setupTestChannel = async () => {
      try {
        // First check if we already have a test channel
        const existingChannel = Array.from(channels.values()).find(
          channel => channel.slug === 'test-channel' && channel.created_by === user.id
        )

        if (existingChannel) {
          setChannelId(existingChannel.id)
          return
        }

        // Create new channel
        const channel = await createChannel({
          slug: 'test-channel',
          created_by: user.id
        })

        if (channel) {
          const processedChannel = await channelProcessor.processChannel(channel)
          setChannels(prev => new Map(prev).set(processedChannel.id, processedChannel))
          setChannelId(channel.id)
        }

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create test channel')
        setError(error)
        console.error('Error creating test channel:', error)
      }
    }

    setupTestChannel()

    // Cleanup function
    return () => {
      setChannelId(null)
    }
  }, [user, channels, channelProcessor, setChannels, createChannel])

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error.message}
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