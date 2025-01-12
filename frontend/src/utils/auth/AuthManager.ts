import { supabase } from '../../lib/supabaseClient'
import { AuthError } from '../errors'
import { User } from '../../types/models'
import { Session } from '@supabase/supabase-js'
import { getPresenceManager } from '../PresenceManager'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  error: Error | null
}

export class AuthManager {
  private refreshTimeout?: NodeJS.Timeout
  private listeners: Set<(state: AuthState) => void>
  private state: AuthState
  private authSubscription: { unsubscribe: () => void } | null = null

  constructor() {
    this.listeners = new Set()
    this.state = {
      user: null,
      loading: true,
      initialized: false,
      error: null
    }

    // Initialize auth state
    this.initialize()
  }

  private async initialize() {
    try {
      // Get initial session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      if (session) {
        await this.handleSession(session)
      }

      // Set up auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session) {
            await this.handleSession(session)
          } else {
            await this.clearSession()
          }
        }
      )

      this.authSubscription = subscription

      // Update state
      this.updateState({
        loading: false,
        initialized: true
      })
    } catch (error) {
      this.handleError(error)
      this.updateState({
        loading: false,
        initialized: true
      })
    }
  }

  private async handleSession(session: Session) {
    try {
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

      // Initialize presence manager
      const presenceManager = getPresenceManager(user.id)
      await presenceManager.initialize()
      await presenceManager.updatePresence('ONLINE')

      // Update state with user
      this.updateState({
        user,
        error: null,
        loading: false
      })

      // Schedule token refresh
      this.scheduleRefresh(session.expires_in)
    } catch (error) {
      this.handleError(error)
    }
  }

  private async clearSession() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    
    // Clean up presence if there was a user
    if (this.state.user) {
      const presenceManager = getPresenceManager(this.state.user.id)
      await presenceManager.cleanup()
    }
    
    this.updateState({
      user: null,
      error: null,
      loading: false
    })
  }

  private scheduleRefresh(expiresIn: number) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    // Refresh 5 minutes before expiry
    const refreshTime = (expiresIn - 300) * 1000
    this.refreshTimeout = setTimeout(() => {
      this.refreshSession()
    }, refreshTime)
  }

  private async refreshSession() {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error

      if (session) {
        await this.handleSession(session)
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  private handleError(error: unknown) {
    const authError = new AuthError(
      error instanceof Error ? error.message : 'An unknown error occurred',
      error instanceof Error ? error : undefined
    )
    this.updateState({ 
      error: authError,
      loading: false
    })
  }

  private updateState(updates: Partial<AuthState>) {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state))
  }

  // Public methods

  /**
   * Subscribe to auth state changes
   */
  public subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener)
    // Immediately notify with current state
    listener(this.state)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Sign in with email and password
   */
  public async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      this.updateState({ loading: true, error: null })
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  /**
   * Sign up with email and password
   */
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

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      this.updateState({ loading: true, error: null })
      
      // Clean up presence before signing out
      if (this.state.user) {
        const presenceManager = getPresenceManager(this.state.user.id)
        await presenceManager.updatePresence('OFFLINE')
        await presenceManager.cleanup()
      }
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      await this.clearSession()
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  /**
   * Update user metadata
   */
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

  /**
   * Reset password
   */
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

  /**
   * Get current auth state
   */
  public getState(): AuthState {
    return this.state
  }

  /**
   * Clean up resources
   */
  public async cleanup() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
    }
    
    // Clean up presence if there was a user
    if (this.state.user) {
      const presenceManager = getPresenceManager(this.state.user.id)
      await presenceManager.updatePresence('OFFLINE')
      await presenceManager.cleanup()
    }
    
    this.listeners.clear()
  }
} 