import Home from './pages/Home';
import Profile from './components/Profile';
import About from './pages/About';
import Messages from './pages/Messages';
import Chat from './pages/Chat';
import AvatarChat from './pages/AvatarChat';
import { AuthCallback } from './components/AuthCallback';

export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  protected: boolean;
  children?: RouteConfig[];
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    element: Home,
    protected: true
  },
  {
    path: '/profile',
    element: Profile,
    protected: true
  },
  {
    path: '/about',
    element: About,
    protected: false
  },
  {
    path: '/messages',
    element: Messages,
    protected: true
  },
  {
    path: '/chat/:channelId?',
    element: Chat,
    protected: true
  },
  {
    path: '/avatar-chat',
    element: AvatarChat,
    protected: true
  },
  {
    path: '/auth/callback',
    element: AuthCallback,
    protected: false
  }
]; 