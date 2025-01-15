import { supabase } from '../../lib/supabaseClient'
import { AuthError } from '../errors'
import { User } from '../../types/models'
import { Session, Subscription } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  error: Error | null
}

export class AuthManager {
  private state: AuthState = {
    user: null,
    loading: true,
    initialized: false,
    error: null
  }

  private listeners = new Set<(state: AuthState) => void>()
  private refreshTimeout: NodeJS.Timeout | null = null
  private authSubscription: Subscription | null = null

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error

      console.log('Initial session:', session) // Debug log

      if (session) {
        await this.handleSession(session)
      } else {
        this.updateState({
          loading: false,
          initialized: true
        })
      }

      // Subscribe to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state change:', event, session) // Debug log
        if (session) {
          await this.handleSession(session)
        } else {
          await this.clearSession()
        }
      })

      this.authSubscription = subscription
    } catch (error) {
      console.error('Auth initialization error:', error) // Debug log
      this.handleError(error)
    }
  }

  private async handleSession(session: Session) {
    try {
      console.log('Handling session:', session) // Debug log

      const emailUsername = session.user.email?.split('@')[0];
      const username = session.user.user_metadata.username || emailUsername || 'unknown';

      // Map Supabase user to our User type
      const user: User = {
        id: session.user.id,
        username,
        full_name: session.user.user_metadata.full_name || 'Unknown User',
        avatar_url: session.user.user_metadata.avatar_url || null,
        created_at: session.user.created_at,
        updated_at: session.user.updated_at || session.user.created_at,
        email: session.user.email,
        is_online: true,
        status: 'ONLINE'
      }

      // Update state with user
      this.updateState({
        user,
        error: null,
        loading: false
      })

      // Schedule token refresh
      this.scheduleRefresh(session.expires_in)
    } catch (error) {
      console.error('Session handling error:', error) // Debug log
      this.handleError(error)
    }
  }

  private async clearSession() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    
    this.updateState({
      user: null,
      error: null,
      loading: false
    })
  }

  private handleError(error: unknown) {
    const authError = error instanceof Error ? new AuthError(error.message) : new AuthError('Unknown error occurred')
    this.updateState({
      error: authError,
      loading: false
    })
  }

  private updateState(update: Partial<AuthState>) {
    this.state = {
      ...this.state,
      ...update,
      initialized: true
    }
    this.notifyListeners()
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state))
  }

  private scheduleRefresh(expiresIn: number) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    // Refresh 5 minutes before expiry
    const refreshTime = (expiresIn - 300) * 1000
    this.refreshTimeout = setTimeout(async () => {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        this.handleError(error)
      }
    }, refreshTime)
  }

  public subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  public async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      this.updateState({ loading: true, error: null })
      console.log('Attempting sign in with email:', email)
      console.log('Supabase client config:', {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKeyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 10)
      })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          redirectTo: window.location.origin
        }
      })

      if (error) {
        console.error('Sign in error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack
        })
        throw error
      }
      
      console.log('Sign in response:', {
        session: data.session ? {
          ...data.session,
          access_token: data.session.access_token.substring(0, 10) + '...',
          expires_at: new Date(data.session.expires_at! * 1000).toISOString(),
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            role: data.session.user.role
          }
        } : null
      })

      // Verify we got a session
      if (!data.session) {
        throw new Error('No session returned after sign in')
      }

      // Store session
      const currentSession = await supabase.auth.getSession()
      console.log('Current session after sign in:', {
        session: currentSession.data.session ? {
          user: currentSession.data.session.user.email,
          expires_at: new Date(currentSession.data.session.expires_at * 1000).toISOString()
        } : null
      })

    } catch (error) {
      console.error('Sign in error:', error)
      this.handleError(error)
      throw error
    }
  }

  public async signUpWithEmail(
    email: string, 
    password: string, 
    metadata: { username: string; full_name: string }
  ): Promise<void> {
    try {
      this.updateState({ loading: true, error: null })
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })
      if (error) throw error
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  public async signOut(): Promise<void> {
    try {
      // Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Set status to offline before signing out
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ status: 'OFFLINE' })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error updating status:', updateError)
        }
      }

      // Sign out
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      await this.clearSession()
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  public async updateUserMetadata(metadata: Partial<{ username: string; full_name: string; avatar_url: string }>) {
    try {
      this.updateState({ loading: true, error: null })
      const { error } = await supabase.auth.updateUser({
        data: metadata
      })
      if (error) throw error
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  public async resetPassword(email: string): Promise<void> {
    try {
      this.updateState({ loading: true, error: null })
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  public getState(): AuthState {
    return this.state
  }

  public async cleanup() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
    }
    
    // Update status to offline in database
    if (this.state.user) {
      await supabase
        .from('profiles')
        .update({ status: 'OFFLINE' })
        .eq('id', this.state.user.id)
    }
    
    this.listeners.clear()
  }
} 