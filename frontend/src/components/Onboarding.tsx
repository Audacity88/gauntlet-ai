import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth()
  const { updateProfile, error: profileError, loading: profileLoading } = useProfile()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!user) throw new Error('No authenticated user')

      await updateProfile({
        username,
        full_name: fullName
      })

      onComplete()
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to complete onboarding'))
      console.error('Onboarding error:', err)
    } finally {
      setLoading(false)
    }
  }

  const isSubmitting = loading || profileLoading
  const displayError = error || profileError

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label 
            htmlFor="fullName" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isSubmitting}
          />
        </div>

        {displayError && (
          <div className="text-red-500 text-sm" role="alert">
            {displayError.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
            bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
            ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}
          `}
        >
          {isSubmitting ? 'Saving...' : 'Complete Profile'}
        </button>
      </form>
    </div>
  )
} 