import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/auth';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code: string };
          user?: { name?: { firstName?: string; lastName?: string }; email?: string };
        }>;
      };
    };
  }
}

// Isolated component so useGoogleLogin hook only runs inside GoogleOAuthProvider
function GoogleButton({ loading, redirectTo }: { loading: boolean; redirectTo: string }) {
  const { socialLogin } = useAuth();
  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        await socialLogin('google', { access_token: tokenResponse.access_token });
        toast.success('Signed in with Google!');
        navigate(redirectTo, { replace: true });
      } catch (err) {
        toast.error((err as Error).message || 'Google sign-in failed. Please try again.');
      }
    },
    onError: () => toast.error('Google sign-in was cancelled or failed.'),
  });

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => login()}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 shadow-sm transition hover:bg-ink-50 disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
        <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
        <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
        <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
      </svg>
      Continue with Google
    </button>
  );
}

type Props = { redirectTo?: string };

export function SocialAuthButtons({ redirectTo = '/dashboard' }: Props) {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const appleScriptLoaded = useRef(false);

  const googleEnabled = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleEnabled  = !!import.meta.env.VITE_APPLE_CLIENT_ID;

  if (!googleEnabled && !appleEnabled) return null;

  // Load Apple Sign In JS SDK once
  useEffect(() => {
    if (!appleEnabled || appleScriptLoaded.current) return;
    appleScriptLoaded.current = true;
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      window.AppleID?.auth.init({
        clientId:    import.meta.env.VITE_APPLE_CLIENT_ID ?? '',
        scope:       'name email',
        redirectURI: window.location.origin,
        usePopup:    true,
      });
    };
    document.head.appendChild(script);
  }, [appleEnabled]);

  async function loginWithApple() {
    if (!window.AppleID) {
      toast.error('Apple Sign In is not available. Please try again.');
      return;
    }
    try {
      const response = await window.AppleID.auth.signIn();
      const idToken  = response.authorization.id_token;
      const firstName = response.user?.name?.firstName ?? '';
      const lastName  = response.user?.name?.lastName  ?? '';
      const name      = [firstName, lastName].filter(Boolean).join(' ');

      await useAuth.getState().socialLogin('apple', {
        identity_token: idToken,
        ...(name ? { name } : {}),
      });
      toast.success('Signed in with Apple!');
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'error' in err && (err as { error: string }).error === 'popup_closed_by_user') return;
      toast.error((err as Error).message || 'Apple sign-in failed. Please try again.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-ink-200" />
        <span className="px-3 text-xs text-ink-400">or continue with</span>
        <div className="flex-1 border-t border-ink-200" />
      </div>

      {googleEnabled && <GoogleButton loading={loading} redirectTo={redirectTo} />}

      {appleEnabled && (
        <button
          type="button"
          disabled={loading}
          onClick={loginWithApple}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 shadow-sm transition hover:bg-ink-50 disabled:opacity-50"
        >
          <svg width="17" height="17" viewBox="0 0 814 1000" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-166.9-112.3C141 399 177.4 157.6 304.9 79.2c41.5-26.2 91.7-38.8 142.8-38.8 52 0 98.3 18.3 138.5 18.3 39.6 0 90.5-20.7 145.4-20.7 26.4.1 102.4 4 154.6 73.9zm-195.1-153.5c24.5-30.5 42.6-73.7 42.6-117 0-5.8-.5-11.7-1.5-16.9-40.6 1.5-88.4 27.2-117.1 61.7-21.9 25.7-41.2 66.1-41.2 108.5 0 6.5 1 13 1.5 15 2.5.5 6.5 1 10.5 1 36.5 0 81.3-24.2 105.2-52.3z"/>
          </svg>
          Continue with Apple
        </button>
      )}
    </div>
  );
}
