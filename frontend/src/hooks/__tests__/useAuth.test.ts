import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { AuthManager } from '../../utils/auth/AuthManager'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock AuthManager
vi.mock('../../utils/auth/AuthManager')

describe('useAuth', () => {
  const mockUser = {
    id: 'test-id',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  }

  const mockInitialState = {
    user: null,
    loading: true,
    initialized: false,
    error: null
  }

  let subscribeMock: (callback: (state: any) => void) => () => void

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock implementation of AuthManager
    subscribeMock = vi.fn((callback) => {
      callback(mockInitialState)
      return vi.fn() // Return mock unsubscribe function
    })

    vi.mocked(AuthManager).mockImplementation(() => ({
      getState: vi.fn().mockReturnValue(mockInitialState),
      subscribe: subscribeMock,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signOut: vi.fn(),
      updateUserMetadata: vi.fn(),
      resetPassword: vi.fn()
    }))
  })

  it('should initialize with AuthManager state', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current).toEqual({
      ...mockInitialState,
      signIn: expect.any(Function),
      signUp: expect.any(Function),
      signOut: expect.any(Function),
      updateProfile: expect.any(Function),
      resetPassword: expect.any(Function)
    })
  })

  it('should update state when AuthManager emits changes', () => {
    const { result } = renderHook(() => useAuth())

    const newState = {
      user: mockUser,
      loading: false,
      initialized: true,
      error: null
    }

    // Simulate AuthManager state change
    act(() => {
      subscribeMock.mock.calls[0][0](newState)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.loading).toBe(false)
    expect(result.current.initialized).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('should cleanup subscription on unmount', () => {
    const unsubscribeMock = vi.fn()
    subscribeMock.mockReturnValueOnce(unsubscribeMock)

    const { unmount } = renderHook(() => useAuth())
    unmount()

    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('should provide auth methods from AuthManager', async () => {
    const { result } = renderHook(() => useAuth())

    // Test signIn
    await act(async () => {
      await result.current.signIn('test@example.com', 'password')
    })
    expect(AuthManager.prototype.signInWithEmail).toHaveBeenCalledWith('test@example.com', 'password')

    // Test signUp
    const metadata = { username: 'newuser', full_name: 'New User' }
    await act(async () => {
      await result.current.signUp('test@example.com', 'password', metadata)
    })
    expect(AuthManager.prototype.signUpWithEmail).toHaveBeenCalledWith('test@example.com', 'password', metadata)

    // Test signOut
    await act(async () => {
      await result.current.signOut()
    })
    expect(AuthManager.prototype.signOut).toHaveBeenCalled()

    // Test updateProfile
    const updateData = { username: 'updateduser' }
    await act(async () => {
      await result.current.updateProfile(updateData)
    })
    expect(AuthManager.prototype.updateUserMetadata).toHaveBeenCalledWith(updateData)

    // Test resetPassword
    await act(async () => {
      await result.current.resetPassword('test@example.com')
    })
    expect(AuthManager.prototype.resetPassword).toHaveBeenCalledWith('test@example.com')
  })
}) 