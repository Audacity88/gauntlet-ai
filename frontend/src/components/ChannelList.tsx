import { memo, useState, useCallback, KeyboardEvent } from 'react';
import { useRealtimeChannels } from '../hooks/useRealtimeChannels';
import { useChannelStore } from '../stores/channelStore';
import { ChannelWithDetails } from '../utils/ChannelProcessor';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from './ErrorBoundary';

interface ChannelError {
  code: string;
  message: string;
  retry?: () => Promise<void>;
}

interface ChannelListProps {
  onChannelSelect: (channel: ChannelWithDetails) => void;
  type?: 'public' | 'private';
  className?: string;
}

const ChannelListContent = memo(function ChannelListContent({
  onChannelSelect,
  type,
  className = ''
}: ChannelListProps) {
  const { user } = useAuth();
  const { channels, createChannel, refreshChannels } = useRealtimeChannels({ type });
  const { activeChannel, loading, error, setError } = useChannelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelSlug, setNewChannelSlug] = useState('');
  const [createError, setCreateError] = useState<ChannelError | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Handle channel creation
  const handleCreateChannel = async () => {
    if (!user || !newChannelSlug.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      await createChannel({
        slug: newChannelSlug.trim(),
        type: type || 'public'
      });
      setNewChannelSlug('');
    } catch (err) {
      setCreateError({
        code: 'CREATE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to create channel',
        retry: handleCreateChannel
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!channels.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < channels.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          onChannelSelect(channels[selectedIndex]);
        }
        break;
    }
  }, [channels, onChannelSelect]);

  // Show loading state with skeleton UI
  if (loading && !channels.length) {
    return (
      <div className={`space-y-2 p-4 ${className}`} role="status" aria-label="Loading channels">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-100 animate-pulse rounded-md flex items-center px-3"
          >
            <div className="w-6 h-6 bg-gray-200 rounded-full mr-3" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <div 
        className={`p-4 ${className}`} 
        role="alert"
        aria-live="polite"
      >
        <div className="text-red-500 mb-3">
          {error.message}
        </div>
        <button
          onClick={() => {
            setError(null);
            refreshChannels();
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Retry loading channels"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`space-y-4 p-4 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Channel creation form */}
      {user && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newChannelSlug}
              onChange={(e) => setNewChannelSlug(e.target.value)}
              placeholder="New channel name"
              className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isCreating}
              aria-label="New channel name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
            />
            <button
              onClick={handleCreateChannel}
              disabled={isCreating || !newChannelSlug.trim()}
              className={`
                px-4 py-2 text-sm font-medium text-white 
                bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 
                rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500
                transition-opacity duration-150
              `}
              aria-label={isCreating ? 'Creating channel...' : 'Create new channel'}
            >
              {isCreating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </div>
              ) : (
                'Create'
              )}
            </button>
          </div>
          {createError && (
            <div 
              className="text-sm text-red-500 flex items-center justify-between"
              role="alert"
            >
              <span>{createError.message}</span>
              {createError.retry && (
                <button
                  onClick={createError.retry}
                  className="text-red-600 hover:text-red-700 font-medium"
                  aria-label="Retry channel creation"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Channel list */}
      <div
        className="space-y-1"
        role="listbox"
        aria-label="Available channels"
      >
        {channels.length === 0 ? (
          <div 
            className="text-gray-500 text-center py-4"
            role="status"
          >
            No channels available
          </div>
        ) : (
          channels.map((channel, index) => (
            <button
              key={channel.id}
              onClick={() => onChannelSelect(channel)}
              className={`
                w-full px-4 py-3 text-left rounded-md
                hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${activeChannel === channel.id ? 'bg-gray-100' : ''}
                ${selectedIndex === index ? 'ring-2 ring-indigo-500' : ''}
                transition-colors duration-150
              `}
              role="option"
              aria-selected={activeChannel === channel.id}
              aria-label={`Select channel ${channel.slug}`}
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-700 font-medium">
                    # {channel.slug}
                  </span>
                  {channel.type === 'private' && (
                    <span 
                      className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full"
                      aria-label="Private channel"
                    >
                      Private
                    </span>
                  )}
                </div>
                {channel.creator && (
                  <div 
                    className="flex items-center space-x-2"
                    aria-label={`Created by ${channel.creator.username}`}
                  >
                    <span className="text-xs text-gray-500">
                      by {channel.creator.username}
                    </span>
                    {channel.member_count && (
                      <span 
                        className="text-xs text-gray-500"
                        aria-label={`${channel.member_count} members`}
                      >
                        · {channel.member_count} members
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
});

export const ChannelList = memo(function ChannelListWrapper(props: ChannelListProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded-lg">
          <p className="font-medium">Failed to load channel list</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-red-600 hover:text-red-700 font-medium"
          >
            Reload Page
          </button>
        </div>
      }
    >
      <ChannelListContent {...props} />
    </ErrorBoundary>
  );
}); 