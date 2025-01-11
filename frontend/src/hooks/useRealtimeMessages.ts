import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Message, MessageWithUser, DirectMessage, DirectMessageWithUser, User, MessageAttachment } from '../types/schema'
import { useAuth } from '../hooks/useAuth'

interface UseRealtimeMessagesProps {
  channelId: string
  chatType?: 'channel' | 'dm'
  searchQuery?: string
}

type AnyMessage = MessageWithUser | DirectMessageWithUser;

interface QueuedMessage {
  id: string
  channel_id: string
  user_id: string
  profile_id: string
  content?: string
  message?: string
  created_at?: string
  inserted_at?: string
  updated_at?: string
  user?: User
  attachments?: MessageAttachment[] | string | null
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}

interface MembershipCache {
  [key: string]: boolean
}

// Cache configuration
const USER_CACHE_KEY = 'cached_users'
const USER_CACHE_EXPIRY = 1000 * 60 * 5 // 5 minutes

interface CachedData<T> {
  data: T
  timestamp: number
}

// User cache utilities
const getUsersFromCache = (): User[] => {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY)
    if (!cached) return []

    const { data, timestamp }: CachedData<User[]> = JSON.parse(cached)
    const isExpired = Date.now() - timestamp > USER_CACHE_EXPIRY
    
    if (isExpired) {
      localStorage.removeItem(USER_CACHE_KEY)
      return []
    }

    return data
  } catch (e) {
    return []
  }
}

const saveUsersToCache = (users: User[]) => {
  try {
    const cacheData: CachedData<User[]> = {
      data: users,
      timestamp: Date.now()
    }
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cacheData))
  } catch (e) {
    console.warn('Failed to cache users:', e)
  }
}

export function useRealtimeMessages({ channelId, chatType = 'channel', searchQuery }: UseRealtimeMessagesProps) {
  // Initialize all state with proper types
  const [messages, setMessages] = useState<AnyMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [membershipCache] = useState<MembershipCache>({})
  const { user } = useAuth()
  
  // Use refs for message tracking to persist between renders
  const processedMessages = useRef(new Set<string>())

  // Enhanced user caching with proper initialization
  const [users, setUsers] = useState<User[]>(() => getUsersFromCache() || [])
  const [userIds, setUserIds] = useState<string[]>([])

  // Memoized user map for faster lookups
  const userMap = useMemo(() => {
    return new Map(users?.map(u => [u.id, u]) || [])
  }, [users])

  // Get user by ID with memoization
  const getUserById = useCallback((id: string): User | undefined => {
    return userMap.get(id)
  }, [userMap])

  // Queue new user IDs for loading with defensive check
  const queueUserLoad = useCallback((ids: string[]) => {
    if (!ids || !Array.isArray(ids)) {
      console.warn('Invalid user IDs:', ids)
      return
    }

    // Filter out undefined, null, or empty IDs and ensure they're strings
    const validIds = ids.filter(id => id && typeof id === 'string' && id.trim() !== '')
    if (validIds.length === 0) {
      console.warn('No valid user IDs to load:', ids)
      return
    }

    console.log('Queueing user IDs for loading:', validIds)
    setUserIds(prev => {
      const prevArray = Array.isArray(prev) ? prev : []
      const uniqueIds = [...new Set([...prevArray, ...validIds])]
      console.log('Updated user IDs queue:', uniqueIds)
      return uniqueIds
    })
  }, [])

  // Process message immediately
  const processMessage = useCallback((newMessage: QueuedMessage) => {
    console.log('=== Processing new message ===', { 
      messageId: newMessage.id,
      eventType: newMessage.eventType,
      content: newMessage.content || newMessage.message,
      attachments: newMessage.attachments
    })
    
    // Don't process messages we've already seen
    if (processedMessages.current.has(newMessage.id)) {
      console.log('Message already processed:', newMessage.id)
      return
    }

    // If message has attachments, handle them inline instead of reloading
    const attachments = newMessage.attachments 
      ? (typeof newMessage.attachments === 'string' 
          ? JSON.parse(newMessage.attachments) 
          : newMessage.attachments)
      : []
    
    console.log('Processing message immediately:', newMessage)

    const messageUser = getUserById(newMessage.user_id)
    if (newMessage.user_id && !messageUser) {
      console.log('Queueing user load for:', newMessage.user_id)
      queueUserLoad([newMessage.user_id])
    }

    setMessages(prev => {
      const prevMessages = Array.isArray(prev) ? prev : []
      const messageMap = new Map(prevMessages.map(m => [m.id, m]))

      // Get the correct content and timestamp based on chat type
      const messageContent = newMessage.content || newMessage.message
      const timestamp = chatType === 'dm' 
        ? newMessage.created_at || new Date().toISOString()
        : newMessage.inserted_at || new Date().toISOString()

      // Check if we already have a temporary version of this message
      const tempMessageId = `temp-${newMessage.id}`
      const existingTempMessage = messageMap.get(tempMessageId)

      // If we have a temp message, use its user data
      const messageObj = {
        id: newMessage.id,
        channel_id: newMessage.channel_id,
        user_id: newMessage.user_id,
        profile_id: newMessage.profile_id,
        content: messageContent,
        message: messageContent,
        created_at: chatType === 'dm' ? timestamp : undefined,
        inserted_at: chatType === 'dm' ? undefined : timestamp,
        updated_at: newMessage.updated_at || timestamp,
        attachments,
        user: messageUser || existingTempMessage?.user || newMessage.user || {
          id: newMessage.user_id,
          username: 'Loading...',
          full_name: 'Loading...',
          avatar_url: null,
          created_at: timestamp,
          updated_at: timestamp
        },
        profile: messageUser || existingTempMessage?.profile || newMessage.user || {
          id: newMessage.user_id,
          username: 'Loading...',
          full_name: 'Loading...',
          avatar_url: null,
          created_at: timestamp,
          updated_at: timestamp
        }
      } as AnyMessage

      // For updates, preserve existing message data that wasn't included in the update
      if (newMessage.eventType === 'UPDATE') {
        const existingMessage = messageMap.get(newMessage.id)
        if (existingMessage) {
          messageObj.attachments = attachments.length > 0 ? attachments : existingMessage.attachments
          messageObj.user = existingMessage.user
          messageObj.profile = existingMessage.profile
        }
      }

      // Only remove the temporary message if we have all the data we need
      if (messageObj.user.username !== 'Loading...' && messageObj.profile.username !== 'Loading...') {
        messageMap.delete(tempMessageId)
      }
      
      // Add the real message
      messageMap.set(newMessage.id, messageObj)

      // Convert map back to array and sort
      const updated = Array.from(messageMap.values())
      updated.sort((a, b) => {
        const getTime = (msg: AnyMessage) => {
          const timestamp = chatType === 'dm' ? msg.created_at : ('inserted_at' in msg ? msg.inserted_at : msg.created_at)
          return new Date(timestamp || new Date().toISOString()).getTime()
        }
        return getTime(a) - getTime(b)
      })

      return updated
    })

    // Mark message as processed
    processedMessages.current.add(newMessage.id)
  }, [chatType, getUserById, queueUserLoad])

  // Update realtime subscription setup with better cleanup
  useEffect(() => {
    if (!channelId || !user) return
    console.log('=== Setting up realtime subscription ===', { channelId, chatType })
    
    // Clear processed messages when changing channels
    processedMessages.current.clear()
    
    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
    const channel = supabase
      .channel(`${table}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('Received realtime message:', payload)
          if (payload.new && 'id' in payload.new) {
            const messageId = payload.new.id as string
            if (!processedMessages.current.has(messageId)) {
              processMessage(payload.new as QueuedMessage)
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up subscription for:', { channelId, chatType })
      processedMessages.current.clear()
      supabase.removeChannel(channel)
    }
  }, [channelId, chatType, user, processMessage])

  // Load initial messages
  useEffect(() => {
    if (!channelId || !user) return
    
    const loadInitialMessages = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const table = chatType === 'dm' ? 'direct_messages' : 'messages'
        let query = supabase
          .from(table)
          .select(`
            *,
            profile:profiles(*)
          `)
          .eq('channel_id', channelId)
          .order(chatType === 'dm' ? 'created_at' : 'inserted_at', { ascending: true })
          .limit(50)

        // Add search filter if query is provided
        if (searchQuery?.trim()) {
          query = query.ilike('content', `%${searchQuery.trim()}%`)
        }

        const { data, error: loadError } = await query

        if (loadError) throw loadError

        if (data) {
          // Queue loading of user data
          const messageUserIds = data
            .map(m => m.user_id)
            .filter(id => id && !userMap.has(id))

          if (messageUserIds.length > 0) {
            console.log('Queueing user IDs from initial load:', messageUserIds)
            queueUserLoad(messageUserIds)
          }

          // Transform messages to have consistent field names
          const transformedMessages = data.map(msg => {
            const messageDate = chatType === 'dm' ? msg.created_at : msg.inserted_at
            return {
              ...msg,
              id: msg.id,
              channel_id: msg.channel_id,
              user_id: msg.profile?.id || msg.user_id,
              profile_id: msg.profile?.id || msg.profile_id,
              content: msg.content,
              message: msg.content,
              created_at: messageDate,
              inserted_at: chatType === 'dm' ? undefined : messageDate,
              updated_at: msg.updated_at || messageDate,
              user: msg.profile || {
                id: msg.user_id,
                username: 'Loading...',
                full_name: 'Loading...',
                avatar_url: null,
                created_at: messageDate,
                updated_at: msg.updated_at || messageDate
              },
              profile: msg.profile || {
                id: msg.user_id,
                username: 'Loading...',
                full_name: 'Loading...',
                avatar_url: null,
                created_at: messageDate,
                updated_at: msg.updated_at || messageDate
              }
            }
          }) as AnyMessage[]

          setMessages(transformedMessages)
          
          // Mark all loaded messages as processed
          transformedMessages.forEach(msg => {
            processedMessages.current.add(msg.id)
          })

          setHasMore(data.length === 50)
        }
      } catch (err) {
        console.error('Error loading messages:', err)
        setError(err instanceof Error ? err : new Error('Failed to load messages'))
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialMessages()
  }, [channelId, chatType, user, queueUserLoad, userMap, searchQuery])

  // Batch user loading with reduced debounce
  useEffect(() => {
    const loadUsers = async () => {
      if (userIds.length === 0) return

      // Filter out userIds that we already have cached and validate IDs
      const missingUserIds = userIds.filter(id => {
        if (!id || typeof id !== 'string' || id.trim() === '') {
          console.warn('Invalid user ID:', id)
          return false
        }
        if (userMap.has(id)) {
          console.log('User already cached:', id)
          return false
        }
        return true
      })

      if (missingUserIds.length === 0) {
        console.log('No missing user IDs to load')
        setUserIds([]) // Clear the queue
        return
      }

      console.log('Loading missing users:', missingUserIds)

      try {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', missingUserIds)

        if (userError) {
          console.error('Error loading users:', userError)
          throw userError
        }

        if (userData && userData.length > 0) {
          console.log('Loaded user data:', userData)
          setUsers(prev => {
            const updated = [...prev]
            userData.forEach(newUser => {
              if (!newUser || !newUser.id) {
                console.warn('Invalid user data:', newUser)
                return
              }
              const index = updated.findIndex(u => u.id === newUser.id)
              if (index === -1) {
                updated.push(newUser)
              } else {
                updated[index] = newUser
              }
            })
            saveUsersToCache(updated)
            return updated
          })
        } else {
          console.warn('No user data returned for IDs:', missingUserIds)
        }

        // Clear processed IDs from the queue
        setUserIds(prev => prev.filter(id => !missingUserIds.includes(id)))
      } catch (err) {
        console.error('Error loading users:', err)
      }
    }

    // Reduced debounce time
    const timeoutId = setTimeout(loadUsers, 50)
    return () => clearTimeout(timeoutId)
  }, [userIds, userMap])

  // Check DM membership with caching
  const checkDmMembership = useCallback(async () => {
    if (!user || chatType !== 'dm' || !channelId) return true
    
    const cacheKey = `dm-${channelId}-${user.id}`
    console.log('Checking DM membership:', { channelId, userId: user.id, cacheKey });
    
    if (membershipCache[cacheKey] !== undefined) {
      console.log('Using cached membership result:', membershipCache[cacheKey]);
      return membershipCache[cacheKey]
    }

    const { error: dmError, data: dmMembership } = await supabase
      .from('direct_message_members')
      .select('*')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single()

    if (dmError) {
      console.error('DM membership check error:', dmError);
    }

    if (!dmMembership) {
      console.log('No DM membership found');
      membershipCache[cacheKey] = false
      return false
    }

    console.log('DM membership found:', dmMembership);
    membershipCache[cacheKey] = true
    return true
  }, [channelId, user?.id, chatType, membershipCache])

  const loadMessages = useCallback(async (cursor?: string) => {
    if (!user) return

    // Check DM membership if this is a DM channel
    const hasMembership = await checkDmMembership()
    if (chatType === 'dm' && !hasMembership) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      
      // Use inserted_at for channel, created_at for dm
      let query = supabase
        .from(table)
        .select(`
          *,
          user:profiles(*)
        `)
        .eq('channel_id', channelId)
        .order(chatType === 'dm' ? 'created_at' : 'inserted_at', { ascending: true })
        .limit(50)

      // For cursor-based pagination
      if (cursor) {
        query = query.gt(chatType === 'dm' ? 'created_at' : 'inserted_at', cursor)
      }

      if (searchQuery?.trim()) {
        query = query.ilike('content', `%${searchQuery.trim()}%`)
      }

      const { data, error: loadError } = await query

      if (loadError) throw loadError

      if (data) {
        // Queue missing users for loading
        const userIds = [...new Set(data.map(m => m.user_id))]
        queueUserLoad(userIds)

        // Transform messages to have consistent field names
        const transformedMessages = data.map(msg => ({
          ...msg,
          content: msg.content,
          message: msg.content,
          created_at: chatType === 'dm' ? msg.created_at : undefined,
          inserted_at: chatType !== 'dm' ? msg.inserted_at : undefined,
          updated_at: msg.updated_at || msg.created_at || msg.inserted_at
        })) as AnyMessage[]

        setMessages(prev => {
          const messageMap = new Map(prev.map(m => [m.id, m]))
          transformedMessages.forEach(msg => messageMap.set(msg.id, msg))
          const updated = Array.from(messageMap.values())

          updated.sort((a, b) => {
            const getTime = (msg: AnyMessage) => {
              const timestamp = chatType === 'dm' ? msg.created_at : ('inserted_at' in msg ? msg.inserted_at : msg.created_at)
              return new Date(timestamp || new Date().toISOString()).getTime()
            }
            return getTime(a) - getTime(b)
          })

          return updated
        })

        setHasMore(data.length === 50)
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user, channelId, chatType, searchQuery, checkDmMembership])

  const sendMessage = useCallback(async (content: string) => {
    console.log('=== Starting sendMessage ===', { chatType, channelId, content })
    if (!user) throw new Error('No user found')
    // Allow empty content since attachments might be present
    const trimmedContent = content.trim()

    if (chatType === 'dm') {
      console.log('Sending DM message...')
      // Check DM membership first
      const hasMembership = await checkDmMembership()
      console.log('DM membership check:', { hasMembership })
      if (!hasMembership) {
        throw new Error('Not a member of this DM channel')
      }

      // Send DM
      console.log('Inserting DM into database...')
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          profile_id: user.id,
          content: trimmedContent || ' ' // Use space if empty to ensure valid content
        })
        .select('*')
        .single()

      if (error) {
        console.error('Error sending DM:', error)
        throw error
      }
      console.log('DM sent successfully:', data)
      return data
    } else {
      // Regular channel message
      console.log('Sending channel message...')
      // First get the user's profile ID for this channel
      console.log('Checking channel membership for:', { channelId, userId: user.id })
      
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('profile_id, role')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single()

      if (memberError) {
        console.error('Error getting member data:', memberError)
        throw memberError
      }

      if (!memberData?.profile_id) {
        console.error('No profile ID found:', memberData)
        throw new Error('No profile ID found for user in this channel')
      }

      console.log('Found member profile:', memberData)
      const now = new Date().toISOString()

      // Send the message with profile_id and use content field
      console.log('Inserting message into database...', {
        channel_id: channelId,
        user_id: user.id,
        profile_id: memberData.profile_id,
        content: trimmedContent || ' ', // Use space if empty to ensure valid content
        inserted_at: now,
        updated_at: now
      })

      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          profile_id: memberData.profile_id,
          content: trimmedContent || ' ', // Use space if empty to ensure valid content
          inserted_at: now,
          updated_at: now
        })
        .select('*, profile:profiles(*)')
        .single()

      if (error) {
        console.error('Error sending message:', error)
        throw error
      }

      console.log('Message sent successfully:', data)
      return data
    }
  }, [user, channelId, chatType, checkDmMembership])

  const updateMessage = useCallback(async (messageId: string | number, content: string) => {
    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
    
    const { data, error: updateError } = await supabase
      .from(table)
      .update({ content })
      .eq('id', messageId)
      .select(`
        *,
        user:profiles(*)
      `)
      .single()

    if (updateError) throw updateError

    // Transform the message to have consistent field names
    if (data) {
      return {
        ...data,
        content: data.content,
        created_at: chatType === 'dm' ? data.created_at : data.inserted_at,
        updated_at: data.updated_at || data.created_at || data.inserted_at
      } as AnyMessage;
    }
    return null;
  }, [chatType])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore: loadMessages,
    sendMessage,
    updateMessage,
    users
  }
} 