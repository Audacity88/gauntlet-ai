import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserList } from '../UserList'
import { useUserCache } from '../../hooks/useUserCache'
import { useAuth } from '../../hooks/useAuth'
import { User } from '../../types/models'

// Mock the hooks
jest.mock('../../hooks/useUserCache')
jest.mock('../../hooks/useAuth')

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    track: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn()
  }))
}

// @ts-ignore
global.supabase = mockSupabase

describe('UserList', () => {
  const mockUser: User = {
    id: 'user1',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const mockUserCache = {
    getUser: jest.fn(),
    setUser: jest.fn(),
    invalidateUser: jest.fn(),
    setUserOnline: jest.fn(),
    setUserOffline: jest.fn(),
    isUserOnline: jest.fn(() => true),
    isLoading: false,
    error: null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useUserCache as jest.Mock).mockReturnValue(mockUserCache)
    ;(useAuth as jest.Mock).mockReturnValue({ user: { id: 'current-user' } })
  })

  it('renders loading skeleton when loading', () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => new Promise(() => {}))
      }))
    }))

    render(<UserList />)
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('renders error message when server error occurs', async () => {
    const errorMessage = 'Failed to fetch users'
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.reject(new Error(errorMessage)))
      }))
    }))

    render(<UserList />)
    
    await waitFor(() => {
      expect(screen.getByText(`Error loading users: ${errorMessage}`)).toBeInTheDocument()
    })
  })

  it('renders error message when cache error occurs', () => {
    ;(useUserCache as jest.Mock).mockReturnValue({
      ...mockUserCache,
      error: new Error('Cache error occurred')
    })

    render(<UserList />)
    expect(screen.getByText('Cache error: Cache error occurred')).toBeInTheDocument()
  })

  it('renders users with online status', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    render(<UserList showPresence={true} />)
    
    await waitFor(() => {
      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument()
      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument()
      // Check for online status indicator
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('(online)')
      )
    })
  })

  it('filters users by online status', async () => {
    const offlineUser = { ...mockUser, id: 'user2', username: 'offline', full_name: 'Offline User' }
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ 
          data: [mockUser, offlineUser], 
          error: null 
        }))
      }))
    }))

    mockUserCache.isUserOnline.mockImplementation((id) => id === mockUser.id)

    const { rerender } = render(<UserList filter="online" />)
    
    await waitFor(() => {
      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument()
      expect(screen.queryByText(offlineUser.full_name)).not.toBeInTheDocument()
    })

    rerender(<UserList filter="offline" />)
    
    await waitFor(() => {
      expect(screen.queryByText(mockUser.full_name)).not.toBeInTheDocument()
      expect(screen.getByText(offlineUser.full_name)).toBeInTheDocument()
    })
  })

  it('calls onUserSelect when user is clicked', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    const handleSelect = jest.fn()
    render(<UserList onUserSelect={handleSelect} />)
    
    await waitFor(() => {
      fireEvent.click(screen.getByText(mockUser.full_name))
      expect(handleSelect).toHaveBeenCalledWith(mockUser.id)
    })
  })

  it('supports keyboard navigation', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    const handleSelect = jest.fn()
    render(<UserList onUserSelect={handleSelect} />)
    
    await waitFor(() => {
      const button = screen.getByRole('button')
      
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(handleSelect).toHaveBeenCalledWith(mockUser.id)

      handleSelect.mockClear()
      fireEvent.keyDown(button, { key: ' ' })
      expect(handleSelect).toHaveBeenCalledWith(mockUser.id)
    })
  })

  it('highlights active user', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    render(<UserList activeUserId={mockUser.id} />)
    
    await waitFor(() => {
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-indigo-100')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('shows empty state when no users match filter', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
    
    render(<UserList />)
    
    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  it('shows avatar placeholder when no avatar_url is provided', async () => {
    const userWithoutAvatar = { ...mockUser, avatar_url: null }
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [userWithoutAvatar], error: null }))
      }))
    }))

    render(<UserList />)
    
    await waitFor(() => {
      expect(screen.getByText('T')).toBeInTheDocument() // First letter of username
    })
  })

  it('handles real-time profile updates', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    render(<UserList />)
    
    await waitFor(() => {
      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument()
    })

    // Simulate profile update
    const updatedUser = { ...mockUser, full_name: 'Updated Name' }
    const channelCallback = mockSupabase.channel().on.mock.calls[1][2]
    
    act(() => {
      channelCallback({
        eventType: 'UPDATE',
        new: updatedUser
      })
    })

    expect(mockUserCache.setUser).toHaveBeenCalledWith(updatedUser.id, updatedUser)
    expect(screen.getByText('Updated Name')).toBeInTheDocument()
  })

  it('handles presence updates', async () => {
    mockSupabase.from.mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    }))

    render(<UserList />)
    
    await waitFor(() => {
      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument()
    })

    // Simulate presence sync
    const presenceCallback = mockSupabase.channel().on.mock.calls[0][2]
    
    act(() => {
      presenceCallback({
        presence: {
          [mockUser.id]: [{ user_id: mockUser.id }]
        }
      })
    })

    expect(mockUserCache.setUserOnline).toHaveBeenCalledWith(mockUser.id)
  })
}) 