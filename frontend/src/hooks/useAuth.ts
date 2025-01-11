import { useEffect, useState } from 'react'
import { AuthManager } from '../utils/auth/AuthManager'
import { User } from '../types/models'

// Singleton instance of AuthManager
const authManager = new AuthManager()

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  error: Error | null
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>(authManager.getState())

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authManager.subscribe((newState: AuthState) => setState(newState))
    return unsubscribe
  }, [])

  return {
    ...state,
    signIn: authManager.signInWithEmail.bind(authManager),
    signUp: authManager.signUpWithEmail.bind(authManager),
    signOut: authManager.signOut.bind(authManager),
    updateProfile: authManager.updateUserMetadata.bind(authManager),
    resetPassword: authManager.resetPassword.bind(authManager)
  }
} 