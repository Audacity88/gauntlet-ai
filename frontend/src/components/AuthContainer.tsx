import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

export function AuthContainer() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-800">ChatGenius</h1>
          <p className="mt-2 text-gray-600">Sign in to start chatting</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              style: {
                button: { width: '100%' },
                anchor: { width: '100%' },
                container: { width: '100%' },
                divider: { margin: '1.5rem 0' },
              },
              variables: {
                default: {
                  colors: {
                    brand: '#4F46E5',
                    brandAccent: '#4338CA',
                  },
                },
              },
            }}
            providers={['github', 'google']}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    </div>
  );
} 