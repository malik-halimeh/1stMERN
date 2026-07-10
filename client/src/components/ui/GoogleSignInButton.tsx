import React, { useEffect, useRef, useState } from 'react';

// Google Identity Services — renders the official "Sign in with Google"
// button. Only shows when VITE_GOOGLE_CLIENT_ID is configured; the credential
// (ID token) is handed to the parent for server-side verification.

declare global {
  interface Window {
    google?: any;
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

let gsiScriptPromise: Promise<void> | null = null;

const loadGsiScript = (): Promise<void> => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiScriptPromise = null;
        reject(new Error('Failed to load Google Sign-In script.'));
      };
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
};

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onCredential, text = 'continue_with' }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID || !buttonRef.current) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential) callbackRef.current(response.credential);
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          width: 320,
          logo_alignment: 'center',
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [text]);

  // Hidden entirely when Google sign-in isn't configured or script blocked
  if (!CLIENT_ID || failed) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3 w-full select-none">
        <div className="flex-grow h-px bg-dashboard-section-bg" />
        <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">or</span>
        <div className="flex-grow h-px bg-dashboard-section-bg" />
      </div>
      <div ref={buttonRef} className="flex justify-center" />
    </div>
  );
};

export default GoogleSignInButton;
