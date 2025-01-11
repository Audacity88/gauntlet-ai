import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthContainer } from './components/AuthContainer';
import { LoadingScreen } from './components/LoadingScreen';
import { Onboarding } from './components/Onboarding';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { User } from './types/models';

function AppContent() {
  const { user, loading, initialized, error } = useAuth();
  
  if (!initialized || loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-red-500">
          {error.message}
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthContainer />;
  }

  if (!user.username) {
    return <Onboarding />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
