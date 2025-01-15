import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate URL format
if (!supabaseUrl?.startsWith('https://') || !supabaseUrl?.includes('.supabase.co')) {
  throw new Error('Invalid Supabase URL format. Must be a valid Supabase project URL.')
}

// Validate key format
if (!supabaseAnonKey?.startsWith('eyJ') || !supabaseAnonKey?.includes('.')) {
  throw new Error('Invalid Supabase anon key format. Must be a valid JWT token.')
}

console.log('Initializing Supabase client with:', {
  url: supabaseUrl,
  anonKey: `${supabaseAnonKey.substring(0, 10)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 10)}`,
  keyLength: supabaseAnonKey.length,
  keyParts: supabaseAnonKey.split('.').length
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
    debug: true,
    onAuthStateChange: (event, session) => {
      console.log('Auth state changed:', { 
        event, 
        session: session ? { 
          user: session.user?.email,
          expires_at: session.expires_at,
          provider: session.user?.app_metadata?.provider
        } : null 
      })
    }
  }
}) 