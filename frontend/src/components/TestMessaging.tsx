import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MessageList } from './MessageList'
import { supabase } from '../lib/supabaseClient'

export function TestMessaging() {
  const { user } = useAuth()
  const [channelId, setChannelId] = useState<string | null>(null)
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
          .eq('name', 'test-channel')
          .eq('created_by', user.id)
          .limit(1)

        if (searchError) throw searchError

        let channel = existingChannels?.[0]

        if (!channel) {
          // Create new channel
          const { data: newChannel, error: channelError } = await supabase
            .from('channels')
            .insert({
              name: 'test-channel',
              description: 'Channel for testing messaging features',
              is_private: false,
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

        // Check existing membership
        const { data: existingMember, error: memberCheckError } = await supabase
          .from('channel_members')
          .select('*')
          .eq('channel_id', channel.id)
          .eq('user_id', user.id)
          .single()

        if (memberCheckError && memberCheckError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw memberCheckError
        }

        if (!existingMember) {
          // Join channel
          const { data: member, error: memberError } = await supabase
            .from('channel_members')
            .insert({
              channel_id: channel.id,
              user_id: user.id,
              role: 'admin'
            })
            .select()
            .single()

          if (memberError) throw memberError
          console.log('✅ Joined test channel:', member)
        } else {
          console.log('✅ Already a member of test channel:', existingMember)
        }

        // Final verification
        const { data: membership, error: verifyError } = await supabase
          .from('channel_members')
          .select('*')
          .eq('channel_id', channel.id)
          .eq('user_id', user.id)
          .single()

        if (verifyError) throw verifyError
        console.log('✅ Verified channel membership:', membership)

        setChannelId(channel.id)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create test channel')
        console.error('❌ Error:', err)
      }
    }

    createTestChannel()

    // Cleanup function
    return () => {
      // We don't delete the channel on unmount because other users might be using it
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
            <li>Hover over a message to add reactions or edit (your messages)</li>
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