import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '../types/models';

interface UserState {
  users: Map<string, User>;
  onlineUsers: Set<string>;
  loading: boolean;
  error: Error | null;

  // User operations
  addUser: (user: User) => void;
  updateUser: (id: string, update: Partial<User>) => void;
  removeUser: (id: string) => void;
  
  // Online status operations
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  setOnlineUsers: (userIds: string[]) => void;

  // Batch operations
  setUsers: (users: User[]) => void;
  clearUsers: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        users: new Map(),
        onlineUsers: new Set(),
        loading: false,
        error: null,

        // User operations
        addUser: (user) =>
          set((state) => {
            const newUsers = new Map(state.users);
            newUsers.set(user.id, user);
            return { users: newUsers };
          }),

        updateUser: (id, update) =>
          set((state) => {
            const user = state.users.get(id);
            if (!user) return state;

            const newUsers = new Map(state.users);
            newUsers.set(id, { ...user, ...update });
            return { users: newUsers };
          }),

        removeUser: (id) =>
          set((state) => {
            const newUsers = new Map(state.users);
            newUsers.delete(id);
            const newOnlineUsers = new Set(state.onlineUsers);
            newOnlineUsers.delete(id);
            return { 
              users: newUsers,
              onlineUsers: newOnlineUsers
            };
          }),

        // Online status operations
        setUserOnline: (id) =>
          set((state) => {
            const newOnlineUsers = new Set(state.onlineUsers);
            newOnlineUsers.add(id);
            return { onlineUsers: newOnlineUsers };
          }),

        setUserOffline: (id) =>
          set((state) => {
            const newOnlineUsers = new Set(state.onlineUsers);
            newOnlineUsers.delete(id);
            return { onlineUsers: newOnlineUsers };
          }),

        setOnlineUsers: (userIds) =>
          set(() => ({
            onlineUsers: new Set(userIds)
          })),

        // Batch operations
        setUsers: (users) =>
          set(() => ({
            users: new Map(users.map(user => [user.id, user])),
            loading: false,
            error: null
          })),

        clearUsers: () =>
          set(() => ({
            users: new Map(),
            onlineUsers: new Set(),
            error: null
          })),

        // Loading state
        setLoading: (loading) => set(() => ({ loading })),
        setError: (error) => set(() => ({ error }))
      }),
      {
        name: 'user-store',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                users: new Map(state.users?.__type === 'Map' ? state.users.data : []),
                onlineUsers: new Set(state.onlineUsers?.__type === 'Set' ? state.onlineUsers.data : [])
              }
            };
          },
          setItem: (name, value) => {
            const { state } = value;
            const serializedState = {
              ...state,
              users: {
                __type: 'Map',
                data: Array.from(state.users.entries())
              },
              onlineUsers: {
                __type: 'Set',
                data: Array.from(state.onlineUsers)
              }
            };
            localStorage.setItem(name, JSON.stringify({ state: serializedState }));
          },
          removeItem: (name) => localStorage.removeItem(name)
        }
      }
    ),
    { name: 'UserStore' }
  )
); 