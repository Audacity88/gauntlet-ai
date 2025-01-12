import { create } from 'zustand'
import { UserStatus } from '../components/StatusManager'
import { supabase } from '../lib/supabaseClient'
import { User } from '../types/models'

interface StatusState {
  userStatuses: Record<string, UserStatus>
  userProfiles: Record<string, User>
  setUserStatus: (userId: string, status: UserStatus) => void
  getUserStatus: (userId: string) => UserStatus | undefined
  getUserProfile: (userId: string) => User | undefined
  subscribeToUserStatus: (userId: string) => () => void
  subscribedUsers: Set<string>
}

export const useStatusStore = create<StatusState>((set, get) => ({
  userStatuses: {},
  userProfiles: {},
  subscribedUsers: new Set(),

  setUserStatus: (userId: string, status: UserStatus) => 
    set((state) => ({
      userStatuses: {
        ...state.userStatuses,
        [userId]: status
      }
    })),

  getUserStatus: (userId: string) => get().userStatuses[userId],

  getUserProfile: (userId: string) => get().userProfiles[userId],

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

    // Initial status and profile fetch
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          // Update both status and profile
          set((state) => ({
            userStatuses: {
              ...state.userStatuses,
              [userId]: data.status as UserStatus
            },
            userProfiles: {
              ...state.userProfiles,
              [userId]: data as User
            }
          }))
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
          if (payload.new) {
            // Update both status and profile
            set((state) => ({
              userStatuses: {
                ...state.userStatuses,
                [userId]: payload.new.status as UserStatus
              },
              userProfiles: {
                ...state.userProfiles,
                [userId]: payload.new as User
              }
            }))
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