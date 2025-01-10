import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Profile } from './components/Profile'
import { Onboarding } from './components/Onboarding'
import { Layout } from './components/Layout'
import About from './pages/About'
import Home from './pages/Home'
import { Messages } from './pages/Messages'

const store = configureStore({
  reducer: {}
})

function AuthContainer() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-800">ChatGenius</h1>
          <p className="mt-2 text-gray-600">Sign in to start chatting</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              style: {
                button: { width: '100%' },
                anchor: { width: '100%' },
                container: { width: '100%' },
                divider: { margin: '1.5rem 0' },
              },
              variables: {
                default: {
                  colors: {
                    brand: '#4F46E5',
                    brandAccent: '#4338CA',
                  },
                },
              },
            }}
            providers={['github', 'google']}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profileChecked, setProfileChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        getProfile()
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        getProfile()
      } else {
        setProfile(null)
        setProfileChecked(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', user.id)
          .maybeSingle()

        if (error) throw error
        setProfile(data)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setProfileChecked(true)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <AuthContainer />
  }

  if (profileChecked && !profile?.username) {
    return <Onboarding onComplete={getProfile} />
  }

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/about"
          element={<About />}
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  )
}

export default App
