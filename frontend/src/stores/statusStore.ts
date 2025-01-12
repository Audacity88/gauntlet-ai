import { create } from 'zustand'
import { UserStatus } from '../components/StatusManager'
import { supabase } from '../lib/supabaseClient'

interface StatusState {
  userStatuses: Record<string, UserStatus>
  setUserStatus: (userId: string, status: UserStatus) => void
  getUserStatus: (userId: string) => UserStatus | undefined
  subscribeToUserStatus: (userId: string) => () => void
  subscribedUsers: Set<string>
}

export const useStatusStore = create<StatusState>((set, get) => ({
  userStatuses: {},
  subscribedUsers: new Set(),

  setUserStatus: (userId: string, status: UserStatus) => {
    console.log('StatusStore - Setting status for user:', userId, 'to:', status)
    set((state) => ({
      userStatuses: {
        ...state.userStatuses,
        [userId]: status
      }
    }))
  },

  getUserStatus: (userId: string) => {
    const status = get().userStatuses[userId]
    console.log('StatusStore - Getting status for user:', userId, 'current value:', status)
    return status
  },

  subscribeToUserStatus: (userId: string) => {
    const state = get()
    
    // If already subscribed, return cleanup function
    if (state.subscribedUsers.has(userId)) {
      return () => {}
    }

    // Add to subscribed users set
    set(state => ({
      subscribedUsers: new Set([...state.subscribedUsers, userId])
    }))

    // Initial status fetch
    supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.status) {
          state.setUserStatus(userId, data.status as UserStatus)
        }
      })

    // Subscribe to changes
    const channel = supabase
      .channel(`public:profiles:id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          if (payload.new && 'status' in payload.new) {
            state.setUserStatus(userId, payload.new.status as UserStatus)
          }
        }
      )
      .subscribe()

    // Return cleanup function
    return () => {
      supabase.removeChannel(channel)
      set(state => ({
        subscribedUsers: new Set(
          Array.from(state.subscribedUsers).filter(id => id !== userId)
        )
      }))
    }
  }
})) 