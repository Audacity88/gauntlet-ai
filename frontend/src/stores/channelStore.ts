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
            console.log('Setting channels:', channelsOrUpdater);
            
            let newChannels: ChannelWithDetails[];
            if (typeof channelsOrUpdater === 'function') {
              const currentChannels = Array.from(state.channels.values());
              newChannels = channelsOrUpdater(currentChannels);
            } else {
              newChannels = channelsOrUpdater;
            }

            // If no channels provided, keep existing state
            if (!newChannels || !Array.isArray(newChannels)) {
              console.warn('No channels provided to setChannels');
              return state;
            }

            // Validate channels before setting
            const validChannels = newChannels.filter((ch): ch is ChannelWithDetails => {
              const isValid = ch && typeof ch === 'object' && 'id' in ch;
              if (!isValid) {
                console.warn('Invalid channel found:', ch);
              }
              return isValid;
            });

            console.log('Setting valid channels:', validChannels);

            // If no valid channels and we already have channels, keep existing state
            if (validChannels.length === 0 && state.channels.size > 0) {
              console.warn('No valid channels in update, keeping existing channels');
              return {
                ...state,
                loading: false,
                error: null
              };
            }

            // Create new Map from valid channels
            const channelsMap = new Map(
              validChannels.map(ch => [ch.id, ch])
            );

            // Merge with existing channels if needed
            const finalChannels = new Map([...state.channels, ...channelsMap]);

            return {
              ...state,
              channels: finalChannels,
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
              
              // Convert serialized maps back to Map objects with better error handling
              const channels = new Map(
                Array.isArray(state?.channels) 
                  ? state.channels 
                  : Array.isArray(state?.channels?.data)
                    ? state.channels.data 
                    : []
              );
              
              const optimisticChannels = new Map(
                Array.isArray(state?.optimisticChannels)
                  ? state.optimisticChannels
                  : Array.isArray(state?.optimisticChannels?.data)
                    ? state.optimisticChannels.data 
                    : []
              );

              return {
                state: {
                  ...state,
                  channels,
                  optimisticChannels,
                  // Ensure other required fields have defaults
                  activeChannel: state?.activeChannel ?? null,
                  loading: false,
                  error: null
                }
              };
            } catch (err) {
              console.error('Error parsing channel store:', err);
              // Return a fresh state on error instead of null
              return {
                state: {
                  channels: new Map(),
                  optimisticChannels: new Map(),
                  activeChannel: null,
                  loading: false,
                  error: null
                }
              };
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