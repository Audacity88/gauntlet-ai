import { useChannelStore } from '../channelStore';
import { Channel } from '../../types/models';

describe('Channel Store', () => {
  const mockChannel: Channel = {
    id: '1',
    slug: 'general',
    type: 'public',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user1'
  };

  beforeEach(() => {
    useChannelStore.setState({
      channels: new Map(),
      activeChannel: null,
      loading: false,
      error: null
    });
  });

  describe('Channel operations', () => {
    it('adds a channel correctly', () => {
      useChannelStore.getState().addChannel(mockChannel);
      const channels = useChannelStore.getState().channels;
      
      expect(channels.size).toBe(1);
      expect(channels.get(mockChannel.id)).toEqual(mockChannel);
    });

    it('updates a channel correctly', () => {
      useChannelStore.getState().addChannel(mockChannel);
      
      const update = { slug: 'updated-general', type: 'private' as const };
      useChannelStore.getState().updateChannel(mockChannel.id, update);
      
      const updatedChannel = useChannelStore.getState().channels.get(mockChannel.id);
      expect(updatedChannel?.slug).toBe('updated-general');
      expect(updatedChannel?.type).toBe('private');
    });

    it('removes a channel correctly', () => {
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().removeChannel(mockChannel.id);
      
      const channels = useChannelStore.getState().channels;
      expect(channels.size).toBe(0);
    });

    it('resets active channel when removing active channel', () => {
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().setActiveChannel(mockChannel.id);
      useChannelStore.getState().removeChannel(mockChannel.id);
      
      const state = useChannelStore.getState();
      expect(state.channels.size).toBe(0);
      expect(state.activeChannel).toBeNull();
    });

    it('maintains active channel when removing different channel', () => {
      const secondChannel = { ...mockChannel, id: '2', slug: 'random' };
      
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().addChannel(secondChannel);
      useChannelStore.getState().setActiveChannel(mockChannel.id);
      useChannelStore.getState().removeChannel(secondChannel.id);
      
      const state = useChannelStore.getState();
      expect(state.channels.size).toBe(1);
      expect(state.activeChannel).toBe(mockChannel.id);
    });
  });

  describe('Active channel management', () => {
    it('sets active channel correctly', () => {
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().setActiveChannel(mockChannel.id);
      
      expect(useChannelStore.getState().activeChannel).toBe(mockChannel.id);
    });

    it('allows setting active channel to null', () => {
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().setActiveChannel(mockChannel.id);
      useChannelStore.getState().setActiveChannel(null);
      
      expect(useChannelStore.getState().activeChannel).toBeNull();
    });
  });

  describe('Batch operations', () => {
    it('sets multiple channels correctly', () => {
      const mockChannels = [
        mockChannel,
        { ...mockChannel, id: '2', slug: 'random' }
      ];
      
      useChannelStore.getState().setChannels(mockChannels);
      
      const channels = useChannelStore.getState().channels;
      expect(channels.size).toBe(2);
      expect(channels.get('1')).toEqual(mockChannels[0]);
      expect(channels.get('2')).toEqual(mockChannels[1]);
    });

    it('clears all channels correctly', () => {
      useChannelStore.getState().addChannel(mockChannel);
      useChannelStore.getState().setActiveChannel(mockChannel.id);
      useChannelStore.getState().clearChannels();
      
      const state = useChannelStore.getState();
      expect(state.channels.size).toBe(0);
      expect(state.activeChannel).toBeNull();
    });
  });

  describe('Loading and error states', () => {
    it('handles loading state correctly', () => {
      useChannelStore.getState().setLoading(true);
      expect(useChannelStore.getState().loading).toBe(true);
      
      useChannelStore.getState().setLoading(false);
      expect(useChannelStore.getState().loading).toBe(false);
    });

    it('handles error state correctly', () => {
      const error = new Error('Test error');
      useChannelStore.getState().setError(error);
      expect(useChannelStore.getState().error).toBe(error);
      
      useChannelStore.getState().setError(null);
      expect(useChannelStore.getState().error).toBe(null);
    });
  });
}); 