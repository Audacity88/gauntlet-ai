import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserPresence } from '../UserPresence';
import { usePresence } from '@/hooks/usePresence';

// Mock usePresence hook
vi.mock('@/hooks/usePresence', () => ({
  usePresence: vi.fn()
}));

describe('UserPresence', () => {
  const mockUserId = 'test-user';
  const mockLastSeen = '2024-01-01T00:00:00Z';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders online status correctly', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'ONLINE',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} />);

    const statusIndicator = screen.getByRole('status');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Online');
    expect(statusIndicator).toHaveClass('bg-green-500');
  });

  it('renders away status correctly', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'AWAY',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} />);

    const statusIndicator = screen.getByRole('status');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Away');
    expect(statusIndicator).toHaveClass('bg-yellow-500');
  });

  it('renders busy status correctly', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'BUSY',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} />);

    const statusIndicator = screen.getByRole('status');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Do not disturb');
    expect(statusIndicator).toHaveClass('bg-red-500');
  });

  it('renders offline status correctly', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'OFFLINE',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} />);

    const statusIndicator = screen.getByRole('status');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Offline');
    expect(statusIndicator).toHaveClass('bg-gray-500');
  });

  it('shows last seen time when offline and showLastSeen is true', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'OFFLINE',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} showLastSeen />);

    expect(screen.getByText(/Last seen/)).toBeInTheDocument();
  });

  it('does not show last seen time when online', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'ONLINE',
      getLastSeen: () => mockLastSeen
    });

    render(<UserPresence userId={mockUserId} showLastSeen />);

    expect(screen.queryByText(/Last seen/)).not.toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'ONLINE',
      getLastSeen: () => mockLastSeen
    });

    const { rerender } = render(<UserPresence userId={mockUserId} size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('w-2 h-2');

    rerender(<UserPresence userId={mockUserId} size="md" />);
    expect(screen.getByRole('status')).toHaveClass('w-3 h-3');

    rerender(<UserPresence userId={mockUserId} size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('w-4 h-4');
  });

  it('handles missing last seen time gracefully', () => {
    (usePresence as jest.Mock).mockReturnValue({
      getUserStatus: () => 'OFFLINE',
      getLastSeen: () => null
    });

    render(<UserPresence userId={mockUserId} showLastSeen />);

    expect(screen.queryByText(/Last seen/)).not.toBeInTheDocument();
  });
}); 