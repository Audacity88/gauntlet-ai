import { supabase } from './frontend/src/lib/supabaseClient'

async function testChannels() {
  console.log('Testing channel functionality...')

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

    console.log('\n--- Testing Public Channel ---\n')

    // 1. Create a public channel
    const { data: publicChannel, error: publicChannelError } = await supabase
      .from('channels')
      .insert({
        name: 'general',
        description: 'Public discussion channel',
        is_private: false,
        created_by: user.id
      })
      .select()
      .single()

    if (publicChannelError) throw publicChannelError
    console.log('✅ Created public channel:', publicChannel)

    // 2. Join the public channel
    const { error: publicMemberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: publicChannel.id,
        user_id: user.id,
        role: 'admin'
      })

    if (publicMemberError) throw publicMemberError
    console.log('✅ Joined public channel as member')

    // 3. Send a message to public channel
    const { data: publicMessage, error: publicMessageError } = await supabase
      .from('messages')
      .insert({
        channel_id: publicChannel.id,
        user_id: user.id,
        content: 'Hello everyone! 👋'
      })
      .select()
      .single()

    if (publicMessageError) throw publicMessageError
    console.log('✅ Sent message to public channel:', publicMessage)

    console.log('\n--- Testing Private Channel ---\n')

    // 4. Create a private channel
    const { data: privateChannel, error: privateChannelError } = await supabase
      .from('channels')
      .insert({
        name: 'secret-team',
        description: 'Private team channel',
        is_private: true,
        created_by: user.id
      })
      .select()
      .single()

    if (privateChannelError) throw privateChannelError
    console.log('✅ Created private channel:', privateChannel)

    // 5. Join the private channel
    const { error: privateMemberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: privateChannel.id,
        user_id: user.id,
        role: 'admin'
      })

    if (privateMemberError) throw privateMemberError
    console.log('✅ Joined private channel as member')

    // 6. Send a message to private channel
    const { data: privateMessage, error: privateMessageError } = await supabase
      .from('messages')
      .insert({
        channel_id: privateChannel.id,
        user_id: user.id,
        content: 'Secret message 🤫'
      })
      .select()
      .single()

    if (privateMessageError) throw privateMessageError
    console.log('✅ Sent message to private channel:', privateMessage)

    // 7. Test reading all channels
    const { data: channels, error: readChannelsError } = await supabase
      .from('channels')
      .select('*')

    if (readChannelsError) throw readChannelsError
    console.log('\n✅ Successfully read all accessible channels:', channels)

    // 8. Test reading all channel members
    const { data: members, error: readMembersError } = await supabase
      .from('channel_members')
      .select('*')

    if (readMembersError) throw readMembersError
    console.log('\n✅ Successfully read all accessible channel members:', members)

    console.log('\n✅ All tests completed successfully!')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testChannels() 