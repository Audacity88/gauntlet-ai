import { useUserStore } from '../userStore';
import { User } from '../../types/models';

describe('User Store', () => {
  const mockUser: User = {
    id: '1',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    useUserStore.setState({
      users: new Map(),
      onlineUsers: new Set(),
      loading: false,
      error: null
    });
  });

  describe('User operations', () => {
    it('adds a user correctly', () => {
      useUserStore.getState().addUser(mockUser);
      const users = useUserStore.getState().users;
      
      expect(users.size).toBe(1);
      expect(users.get(mockUser.id)).toEqual(mockUser);
    });

    it('updates a user correctly', () => {
      useUserStore.getState().addUser(mockUser);
      
      const update = { full_name: 'Updated Name', avatar_url: 'https://example.com/avatar.jpg' };
      useUserStore.getState().updateUser(mockUser.id, update);
      
      const updatedUser = useUserStore.getState().users.get(mockUser.id);
      expect(updatedUser?.full_name).toBe('Updated Name');
      expect(updatedUser?.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('removes a user correctly', () => {
      useUserStore.getState().addUser(mockUser);
      useUserStore.getState().removeUser(mockUser.id);
      
      const users = useUserStore.getState().users;
      expect(users.size).toBe(0);
    });

    it('removes user from online users when removing user', () => {
      useUserStore.getState().addUser(mockUser);
      useUserStore.getState().setUserOnline(mockUser.id);
      useUserStore.getState().removeUser(mockUser.id);
      
      const state = useUserStore.getState();
      expect(state.users.size).toBe(0);
      expect(state.onlineUsers.size).toBe(0);
    });
  });

  describe('Online status operations', () => {
    it('sets user online correctly', () => {
      useUserStore.getState().addUser(mockUser);
      useUserStore.getState().setUserOnline(mockUser.id);
      
      const onlineUsers = useUserStore.getState().onlineUsers;
      expect(onlineUsers.has(mockUser.id)).toBe(true);
    });

    it('sets user offline correctly', () => {
      useUserStore.getState().addUser(mockUser);
      useUserStore.getState().setUserOnline(mockUser.id);
      useUserStore.getState().setUserOffline(mockUser.id);
      
      const onlineUsers = useUserStore.getState().onlineUsers;
      expect(onlineUsers.has(mockUser.id)).toBe(false);
    });

    it('sets multiple online users correctly', () => {
      const userIds = ['1', '2', '3'];
      useUserStore.getState().setOnlineUsers(userIds);
      
      const onlineUsers = useUserStore.getState().onlineUsers;
      expect(onlineUsers.size).toBe(3);
      userIds.forEach(id => {
        expect(onlineUsers.has(id)).toBe(true);
      });
    });
  });

  describe('Batch operations', () => {
    it('sets multiple users correctly', () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: '2', username: 'testuser2' }
      ];
      
      useUserStore.getState().setUsers(mockUsers);
      
      const users = useUserStore.getState().users;
      expect(users.size).toBe(2);
      expect(users.get('1')).toEqual(mockUsers[0]);
      expect(users.get('2')).toEqual(mockUsers[1]);
    });

    it('clears all users correctly', () => {
      useUserStore.getState().addUser(mockUser);
      useUserStore.getState().setUserOnline(mockUser.id);
      useUserStore.getState().clearUsers();
      
      const state = useUserStore.getState();
      expect(state.users.size).toBe(0);
      expect(state.onlineUsers.size).toBe(0);
    });
  });

  describe('Loading and error states', () => {
    it('handles loading state correctly', () => {
      useUserStore.getState().setLoading(true);
      expect(useUserStore.getState().loading).toBe(true);
      
      useUserStore.getState().setLoading(false);
      expect(useUserStore.getState().loading).toBe(false);
    });

    it('handles error state correctly', () => {
      const error = new Error('Test error');
      useUserStore.getState().setError(error);
      expect(useUserStore.getState().error).toBe(error);
      
      useUserStore.getState().setError(null);
      expect(useUserStore.getState().error).toBe(null);
    });
  });
}); 