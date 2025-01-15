import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

export function AuthContainer() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-800">ChatGenius</h1>
          <p className="mt-2 text-gray-600">Create an account or sign in to continue</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <Auth
            supabaseClient={supabase}
            view="sign_in"
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
                    brandAccent: '#4338CA'
                  }
                }
              }
            }}
            localization={{
              variables: {
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Create account',
                  loading_button_label: 'Creating account...',
                  link_text: 'Need an account? Sign up'
                },
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  button_label: 'Sign in',
                  loading_button_label: 'Signing in...',
                  link_text: "Don't have an account? Sign up"
                }
              }
            }}
            providers={['github', 'google']}
            redirectTo={window.location.origin}
            onlyThirdPartyProviders={false}
            magicLink={false}
            showLinks={true}
          />
        </div>
      </div>
    </div>
  );
} 