import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'
import { useUserCache } from './useUserCache'

interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url?: string | null
  status?: string | null
}

interface UseProfileResult {
  profile: Profile | null
  loading: boolean
  error: Error | null
  updateProfile: (data: Partial<Profile>) => Promise<void>
  getProfile: () => Promise<void>
}

export function useProfile(): UseProfileResult {
  const { user } = useAuth()
  const { setUser } = useUserCache()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const getProfile = useCallback(async () => {
    try {
      setError(null)
      if (!user) {
        setProfile(null)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, status')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError
      
      if (data) {
        setProfile(data)
        // Update the user cache
        setUser(data.id, data)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load profile'))
    } finally {
      setLoading(false)
    }
  }, [user, setUser])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    try {
      setError(null)
      if (!user) throw new Error('No authenticated user')

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })

      if (updateError) throw updateError

      // Refresh profile after update
      await getProfile()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update profile'))
      throw err
    }
  }, [user, getProfile])

  return {
    profile,
    loading,
    error,
    updateProfile,
    getProfile
  }
} 