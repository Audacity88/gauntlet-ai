import { supabase } from './frontend/src/lib/supabaseClient'

async function testMessages() {
  console.log('Testing message functionality...')

  try {
    // Sign in with test credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'dangilles@outlook.com',
      password: 'mango888'
    })

    if (signInError) throw signInError
    console.log('✅ Signed in successfully')

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Not authenticated')

    console.log('✅ Got current user:', user.id)

    // 1. Create a test channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert({
        name: 'message-test',
        description: 'Channel for testing messages',
        is_private: false,
        created_by: user.id
      })
      .select()
      .single()

    if (channelError) throw channelError
    console.log('✅ Created test channel:', channel)

    // 2. Join the channel
    const { error: memberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: channel.id,
        user_id: user.id,
        role: 'admin'
      })

    if (memberError) throw memberError
    console.log('✅ Joined channel as member')

    // 3. Send a regular message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        channel_id: channel.id,
        user_id: user.id,
        content: 'This is a test message with *markdown* and a [link](https://example.com)',
        is_ai_generated: false
      })
      .select()
      .single()

    if (messageError) throw messageError
    console.log('✅ Created message:', message)

    // 4. Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({ content: 'Updated message content' })
      .eq('id', message.id)

    if (updateError) throw updateError
    console.log('✅ Updated message')

    // 5. Add a reaction
    const { error: reactionError } = await supabase
      .from('message_reactions')
      .insert({
        message_id: message.id,
        user_id: user.id,
        emoji: '👍'
      })

    if (reactionError) throw reactionError
    console.log('✅ Added reaction')

    // 6. Create a message with attachment
    const { data: attachmentMessage, error: attachmentMessageError } = await supabase
      .from('messages')
      .insert({
        channel_id: channel.id,
        user_id: user.id,
        content: 'Message with attachment',
        is_ai_generated: false
      })
      .select()
      .single()

    if (attachmentMessageError) throw attachmentMessageError

    const { error: attachmentError } = await supabase
      .from('message_attachments')
      .insert({
        message_id: attachmentMessage.id,
        file_name: 'test.txt',
        file_type: 'text/plain',
        file_size: 1024,
        file_url: 'https://example.com/test.txt'
      })

    if (attachmentError) throw attachmentError
    console.log('✅ Created message with attachment')

    // 7. Create a threaded reply
    const { error: replyError } = await supabase
      .from('messages')
      .insert({
        channel_id: channel.id,
        user_id: user.id,
        content: 'This is a threaded reply',
        parent_id: message.id,
        is_ai_generated: false
      })

    if (replyError) throw replyError
    console.log('✅ Created threaded reply')

    // 8. Test reading messages
    const { data: messages, error: readError } = await supabase
      .from('messages')
      .select(`
        *,
        reactions:message_reactions(*),
        attachments:message_attachments(*)
      `)
      .eq('channel_id', channel.id)

    if (readError) throw readError
    console.log('\n✅ Successfully read messages with reactions and attachments:', messages)

    // 9. Test real-time broadcasting
    console.log('\n--- Testing Real-time Broadcasting ---\n')
    
    const subscription = supabase
      .channel(`channel-${channel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channel.id}`
      }, (payload) => {
        console.log('🔔 Received broadcasted message:', payload.new)
      })
      .subscribe()

    console.log('✅ Subscribed to channel messages')

    // Send a broadcast message
    setTimeout(async () => {
      console.log('Sending broadcast message...')
      const { error: broadcastError } = await supabase
        .from('messages')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          content: 'This is a broadcasted message!',
          is_ai_generated: false
        })

      if (broadcastError) throw broadcastError
      console.log('✅ Sent broadcast message')

      // Clean up subscription after a moment
      setTimeout(() => {
        subscription.unsubscribe()
        console.log('\n✅ All message tests completed successfully!')
      }, 1000)
    }, 1000)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testMessages() 