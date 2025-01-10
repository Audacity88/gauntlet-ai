import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Message, MessageWithUser, DirectMessage, DirectMessageWithUser, AnyMessage } from '../types/messages'
import { User } from '../types/schema'
import { useAuth } from '../hooks/useAuth'

interface UseRealtimeMessagesProps {
  channelId: string
  chatType?: 'channel' | 'dm'
  searchQuery?: string
}

type QueuedMessage = {
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
    if (!newMessage?.id || processedMessages.current.has(newMessage.id)) {
      console.log('Message already processed or invalid:', newMessage?.id)
      return
    }

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
          user: messageUser || newMessage.user || {
            id: newMessage.user_id,
            username: 'Loading...',
            full_name: 'Loading...',
            avatar_url: null,
          created_at: timestamp,
          updated_at: timestamp
          }
        } as AnyMessage

        messageMap.set(newMessage.id, messageObj)
      processedMessages.current.add(newMessage.id)

      // Convert map back to array and sort
      const updated = Array.from(messageMap.values())
      updated.sort((a, b) => {
        const aTime = chatType === 'dm' 
          ? (a as DirectMessageWithUser).created_at || ''
          : (a as MessageWithUser).inserted_at || ''
        const bTime = chatType === 'dm' 
          ? (b as DirectMessageWithUser).created_at || ''
          : (b as MessageWithUser).inserted_at || ''
        return new Date(aTime).getTime() - new Date(bTime).getTime()
      })

      return updated
    })
  }, [chatType, getUserById, queueUserLoad])

  // Update realtime subscription setup
  useEffect(
    () => {
      if (!channelId || !user) {
        console.log('No channelId or user, skipping subscription')
        return
      }

      // Clear processed messages when changing channels
      processedMessages.current.clear()

      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      console.log('Setting up realtime subscription for:', { table, channelId })
      
      const channel = supabase
        .channel(`messages:${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `channel_id=eq.${channelId}`
          },
          async (payload) => {
            console.log('Received realtime event:', payload)
            if (payload.new && 'id' in payload.new) {
              const messageId = payload.new.id as string
              
              if (!processedMessages.current.has(messageId)) {
                console.log('Processing new message:', payload.new)
                
                // Get the user from cache or fetch if needed
                const messageUserId = payload.new.user_id as string
                let messageUser = getUserById(messageUserId)

                if (!messageUser) {
                  console.log('Fetching user data for:', messageUserId)
                  // Only fetch the user data if we don't have it
                  const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', messageUserId)
                    .single()

                  if (!userError && userData) {
                    console.log('Found user data:', userData)
                    messageUser = userData
                    // Update user cache
                    setUsers(prev => {
                      const updated = [...prev]
                      const index = updated.findIndex(u => u.id === userData.id)
                      if (index === -1) {
                        updated.push(userData)
                      } else {
                        updated[index] = userData
                      }
                      saveUsersToCache(updated)
                      return updated
                    })
                  } else {
                    console.error('Error fetching user data:', userError)
                  }
                }

                const queuedMessage: QueuedMessage = {
                  id: messageId,
                  channel_id: payload.new.channel_id as string,
                  user_id: messageUserId,
                  profile_id: payload.new.profile_id as string,
                  content: payload.new.content as string,
                  message: payload.new.content as string,
                  created_at: payload.new.created_at as string,
                  inserted_at: payload.new.inserted_at as string,
                  updated_at: payload.new.updated_at as string,
                  user: messageUser,
                  eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
                }
                console.log('Processing message with user data:', queuedMessage)
                processMessage(queuedMessage)
              } else {
                console.log('Skipping already processed message:', messageId)
              }
            }
          }
        )
        .subscribe()

      return () => {
        console.log('Cleaning up subscription for:', { channelId, chatType })
        channel.unsubscribe()
      }
    },
    [channelId, chatType, user, processMessage, getUserById, setUsers]
  )

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
            user:profiles(*)
          `)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })
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
          const transformedMessages = data.map(msg => ({
            ...msg,
            content: msg.content,
            message: msg.content,
            created_at: msg.created_at,
            updated_at: msg.updated_at || msg.created_at,
            user: msg.user || {
              id: msg.user_id,
              username: 'Loading...',
              full_name: 'Loading...',
              avatar_url: null,
              created_at: msg.created_at,
              updated_at: msg.updated_at || msg.created_at
            }
          })) as AnyMessage[]

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
      console.log('User is not a member of this DM channel')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      let query = supabase
        .from(table)
        .select(`
          *,
          user:profiles(*)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (cursor) {
        query = query.gt('created_at', cursor)
      }

      // Add search filter if query is provided
      if (searchQuery?.trim()) {
        query = query.ilike('content', `%${searchQuery.trim()}%`)
      }

      const { data, error: loadError } = await query

      if (loadError) throw loadError

      if (data) {
        // Queue loading of user data
        const userIds = [...new Set(data.map(m => m.user_id))]
        queueUserLoad(userIds)

        // Transform messages to have consistent field names
        const transformedMessages = data.map(msg => ({
          ...msg,
          content: msg.content,
          message: msg.content,
          created_at: msg.created_at,
          updated_at: msg.updated_at || msg.created_at
        })) as AnyMessage[]

        setMessages(prev => {
          // Create a map of existing messages
          const messageMap = new Map(prev.map(m => [m.id, m]))
          
          // Add new messages to the map, overwriting any existing ones
          transformedMessages.forEach(msg => messageMap.set(msg.id, msg))
          
          // Convert map back to array and sort by created_at
          const updated = Array.from(messageMap.values())
          updated.sort((a, b) => {
            const aTime = a.created_at
            const bTime = b.created_at
            return new Date(aTime).getTime() - new Date(bTime).getTime()
          })
          
          return updated
        })

        setHasMore(data.length === 50)
      }
    } catch (err) {
      console.error('Error loading messages:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [user, channelId, chatType, searchQuery, checkDmMembership])

  const sendMessage = useCallback(async (content: string) => {
    if (!user) throw new Error('No authenticated user')

    if (chatType === 'dm') {
      console.log('Sending DM with:', { channelId, userId: user.id, content });
      
      // Check if we're a member of this specific channel
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('direct_message_members')
        .select('profile_id')
        .eq('channel_id', channelId)  // Check for this specific channel
        .eq('user_id', user.id)
        .single()

      if (memberCheckError && memberCheckError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking member data:', memberCheckError)
        throw memberCheckError
      }

      let memberData = existingMember
      
      if (!existingMember) {
        // Get the user's profile ID - note that for DMs, user.id is the same as profile.id
        memberData = { profile_id: user.id }
      }

      if (!memberData?.profile_id) {
        throw new Error('No profile ID found for user')
      }

      console.log('Found member profile:', memberData);

      // Use the database function for DMs to handle everything in one transaction
      const { data, error: sendError } = await supabase
        .rpc('send_direct_message', {
          p_channel_id: channelId,
          p_user_id: user.id,
          p_profile_id: memberData.profile_id,
          p_content: content
        })

      if (sendError) {
        console.error('Error sending DM:', sendError)
        throw sendError
      }

      console.log('DM sent successfully:', data);
      return data
    } else {
      // Regular channel message
      // First get the user's profile ID for this channel
      console.log('Checking channel membership for:', { channelId, userId: user.id });
      
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
        throw new Error('No profile ID found for user in this channel')
      }

      console.log('Found member profile:', memberData);
      console.log('Attempting to send message with:', {
        channel_id: channelId,
        user_id: user.id,
        profile_id: memberData.profile_id,
        content: content
      });

      // Send the message with profile_id and use content field
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          profile_id: memberData.profile_id,
          content: content
        })
        .select('*')
        .single()

      if (error) {
        console.error('Error sending message:', error)
        throw error
      }

      console.log('Message sent successfully:', data);
      return data
    }
  }, [user, channelId, chatType])

  const updateMessage = useCallback(async (messageId: string | number, content: string) => {
    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
    const contentField = chatType === 'dm' ? 'content' : 'message'
    const updateData = { [contentField]: content }
    
    const { data, error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', messageId)
      .select(`
        *,
        user:profiles(*)
      `)
      .single()

    if (updateError) throw updateError

    // Transform the message to have consistent field names
    if (chatType !== 'dm' && data) {
      return {
        ...data,
        content: data.message,
        created_at: data.inserted_at,
        updated_at: data.inserted_at
      } as AnyMessage;
    }
    return data as AnyMessage;
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