import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Channel } from '../types/models';
import { ChannelWithDetails } from '../utils/ChannelProcessor';

interface ChannelState {
  channels: Map<string, ChannelWithDetails>;
  activeChannel: string | null;
  loading: boolean;
  error: Error | null;
  optimisticChannels: Map<string, ChannelWithDetails>;

  // Channel operations
  addChannel: (channel: ChannelWithDetails) => void;
  updateChannel: (id: string, update: Partial<ChannelWithDetails>) => void;
  removeChannel: (id: string) => void;
  setActiveChannel: (id: string | null) => void;

  // Optimistic operations
  addOptimisticChannel: (channel: ChannelWithDetails) => void;
  removeOptimisticChannel: (id: string) => void;
  clearOptimisticChannels: () => void;

  // Batch operations
  setChannels: (channelsOrUpdater: ChannelWithDetails[] | ((prev: Map<string, ChannelWithDetails>) => ChannelWithDetails[])) => void;
  clearChannels: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useChannelStore = create<ChannelState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        channels: new Map(),
        optimisticChannels: new Map(),
        activeChannel: null,
        loading: false,
        error: null,

        // Channel operations
        addChannel: (channel) =>
          set((state) => {
            const newChannels = new Map(state.channels);
            newChannels.set(channel.id, channel);
            return { channels: newChannels };
          }),

        updateChannel: (id, update) =>
          set((state) => {
            const channel = state.channels.get(id);
            if (!channel) return state;

            const newChannels = new Map(state.channels);
            newChannels.set(id, { ...channel, ...update });
            return { channels: newChannels };
          }),

        removeChannel: (id) =>
          set((state) => {
            const newChannels = new Map(state.channels);
            newChannels.delete(id);
            // Reset active channel if it was the one removed
            const newActiveChannel = 
              state.activeChannel === id ? null : state.activeChannel;
            return { 
              channels: newChannels,
              activeChannel: newActiveChannel
            };
          }),

        setActiveChannel: (id) =>
          set(() => ({
            activeChannel: id
          })),

        // Optimistic operations
        addOptimisticChannel: (channel) =>
          set((state) => {
            const newOptimistic = new Map(state.optimisticChannels);
            newOptimistic.set(channel.id, channel);
            return { optimisticChannels: newOptimistic };
          }),

        removeOptimisticChannel: (id) =>
          set((state) => {
            const newOptimistic = new Map(state.optimisticChannels);
            newOptimistic.delete(id);
            return { optimisticChannels: newOptimistic };
          }),

        clearOptimisticChannels: () =>
          set(() => ({
            optimisticChannels: new Map()
          })),

        // Batch operations
        setChannels: (channelsOrUpdater) =>
          set((state) => {
            const channels = typeof channelsOrUpdater === 'function' 
              ? channelsOrUpdater(state.channels)
              : channelsOrUpdater;

            const newChannels = new Map(
              (Array.isArray(channels) ? channels : [])
                .filter(ch => ch && ch.id)
                .map(ch => [ch.id, ch])
            );

            return {
              channels: newChannels,
              loading: false,
              error: null
            };
          }),

        clearChannels: () =>
          set(() => ({
            channels: new Map(),
            optimisticChannels: new Map(),
            activeChannel: null,
            error: null
          })),

        // Loading state
        setLoading: (loading) => set(() => ({ loading })),
        setError: (error) => set(() => ({ error }))
      }),
      {
        name: 'channel-store',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            
            try {
              const { state } = JSON.parse(str);
              
              // Convert serialized maps back to Map objects
              const channels = new Map(
                Array.isArray(state.channels) 
                  ? state.channels 
                  : state.channels?.data || []
              );
              
              const optimisticChannels = new Map(
                Array.isArray(state.optimisticChannels)
                  ? state.optimisticChannels
                  : state.optimisticChannels?.data || []
              );

              return {
                state: {
                  ...state,
                  channels,
                  optimisticChannels
                }
              };
            } catch (err) {
              console.error('Error parsing channel store:', err);
              return null;
            }
          },
          setItem: (name, value) => {
            const { state } = value;
            const serializedState = {
              ...state,
              channels: Array.from(state.channels.entries()),
              optimisticChannels: Array.from(state.optimisticChannels.entries())
            };
            localStorage.setItem(name, JSON.stringify({ state: serializedState }));
          },
          removeItem: (name) => localStorage.removeItem(name)
        },
        version: 1
      }
    ),
    { name: 'ChannelStore' }
  )
); 