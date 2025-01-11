import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { User } from '../types/schema'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Map Supabase user to our User type
        setUser({
          id: session.user.id,
          username: session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Unknown',
          full_name: session.user.user_metadata.full_name || 'Unknown User',
          avatar_url: session.user.user_metadata.avatar_url,
          created_at: session.user.created_at,
          updated_at: session.user.updated_at
        })
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Map Supabase user to our User type
        setUser({
          id: session.user.id,
          username: session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Unknown',
          full_name: session.user.user_metadata.full_name || 'Unknown User',
          avatar_url: session.user.user_metadata.avatar_url,
          created_at: session.user.created_at,
          updated_at: session.user.updated_at
        })
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
} 