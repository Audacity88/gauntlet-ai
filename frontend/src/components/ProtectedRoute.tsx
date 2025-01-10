import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('ProtectedRoute: Checking session...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('ProtectedRoute: Session status:', session ? 'authenticated' : 'unauthenticated')
      setSession(session)
      setLoading(false)
    })
  }, [])

  if (loading) {
    console.log('ProtectedRoute: Loading...')
    return <div>Loading...</div>
  }

  if (!session) {
    console.log('ProtectedRoute: No session, redirecting to login')
    return <Navigate to="/login" replace />
  }

  console.log('ProtectedRoute: Rendering protected content')
  return <>{children}</>
} 