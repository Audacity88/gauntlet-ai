import { supabase } from './frontend/src/lib/supabaseClient'

async function testMessagePersistence() {
  console.log('Testing message persistence...')

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
        name: 'persistence-test',
        description: 'Channel for testing message persistence',
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

    // 3. Create multiple messages for pagination testing
    console.log('\nCreating test messages...')
    const messageCount = 25
    for (let i = 0; i < messageCount; i++) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          content: `Test message ${i + 1}`,
          is_ai_generated: false
        })

      if (messageError) throw messageError
      process.stdout.write('.')
    }
    console.log('\n✅ Created test messages')

    // 4. Test pagination with cursor
    console.log('\nTesting message pagination...')
    const pageSize = 10
    let lastId: string | null = null
    let allMessages: any[] = []

    while (true) {
      const query = supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .limit(pageSize)

      if (lastId) {
        query.lt('id', lastId)
      }

      const { data: messages, error: readError } = await query

      if (readError) throw readError
      if (!messages || messages.length === 0) break

      allMessages = allMessages.concat(messages)
      lastId = messages[messages.length - 1].id
      console.log(`✅ Loaded page of ${messages.length} messages`)
    }

    console.log(`✅ Total messages loaded: ${allMessages.length}`)

    // 5. Test message search/filtering
    console.log('\nTesting message search...')
    const { data: searchResults, error: searchError } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .ilike('content', '%test message 1%')
      .order('created_at', { ascending: false })

    if (searchError) throw searchError
    console.log(`✅ Found ${searchResults?.length} messages matching search`)

    // 6. Test message range loading
    console.log('\nTesting message range loading...')
    const startDate = new Date()
    startDate.setHours(startDate.getHours() - 1)

    const { data: recentMessages, error: rangeError } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (rangeError) throw rangeError
    console.log(`✅ Loaded ${recentMessages?.length} messages from the last hour`)

    console.log('\n✅ All persistence tests completed successfully!')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testMessagePersistence() 