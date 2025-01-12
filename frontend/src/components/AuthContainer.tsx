import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';
import { useCallback } from 'react';

export function AuthContainer() {
  const handleAuthError = useCallback((error: Error) => {
    console.error('Auth error:', error);
  }, []);

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
                message: { color: 'red' }
              },
              variables: {
                default: {
                  colors: {
                    brand: '#4F46E5',
                    brandAccent: '#4338CA',
                    messageText: 'red',
                    messageBackground: '#FEE2E2'
                  },
                },
              },
            }}
            providers={['github', 'google']}
            redirectTo={window.location.origin}
            magicLink={false}
            view="sign_in"
            showLinks={true}
            onError={handleAuthError}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Sign in',
                  loading_button_label: 'Signing in...',
                  link_text: "Don't have an account? Sign up",
                  email_input_placeholder: 'Your email address',
                  password_input_placeholder: 'Your password'
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Sign up',
                  loading_button_label: 'Signing up...',
                  link_text: 'Already have an account? Sign in',
                  email_input_placeholder: 'Your email address',
                  password_input_placeholder: 'Choose a password'
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
} 