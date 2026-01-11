'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type Props = { open: boolean; onClose: () => void };

export default function SignInPopUp({ open, onClose }: Props) {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr(error.message);
    else onClose(); // success -> close popup
  }

  async function handleGoogle() {
    setErr(null);
    const redirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(pathname || '/')}`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  return (
    <div
      // NOTE: no click-outside handler
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        // Stop any bubbling just in case
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#111',
          color: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,.4)',
          position: 'relative',
        }}
      >
        {/* Close (X) only – ESC disabled */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#222',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ×
        </button>

        {/* Logo from /public/logo.png */}
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 160, height: 48, objectFit: 'contain' }} />
        </div>

        <h2 style={{ textAlign: 'center', margin: '4px 0 14px' }}>Sign in</h2>

        <form onSubmit={handleEmailSignIn} style={{ display: 'grid', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: '#000',
              color: '#fff',
              border: '1px solid #444',
              padding: '10px 12px',
              borderRadius: 8,
              outline: 'none',
            }}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#000',
                color: '#fff',
                border: '1px solid #444',
                padding: '10px 40px 10px 12px',
                borderRadius: 8,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                height: 28,
                width: 28,
                borderRadius: 6,
                background: '#222',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
              title={showPw ? 'Hide' : 'Show'}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <a href="#" style={{ color: '#aaa', fontSize: 12, textAlign: 'center' }}>
            Forgot password?
          </a>

          <button
            type="submit"
            disabled={busy}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '14px 0', color: '#bbb' }}>
          Or Sign In With Google
        </div>

        <div style={{ display: 'grid', placeItems: 'center' }}>
          <button
            onClick={handleGoogle}
            style={{
              background: '#000',
              border: '1px solid #444',
              padding: 8,
              borderRadius: 10,
              cursor: 'pointer',
            }}
            aria-label="Sign in with Google"
          >
            <img src="/google.png" alt="Google" style={{ width: 36, height: 36 }} />
          </button>
        </div>

        {err && <p style={{ color: '#ff8a8a', marginTop: 10, textAlign: 'center' }}>{err}</p>}

        <p style={{ textAlign: 'center', marginTop: 14, color: '#bbb' }}>
          New to the game?{' '}
          <a href="/sign-up" style={{ color: '#fff', textDecoration: 'underline' }}>
            Join Now!
          </a>
        </p>
      </div>
    </div>
  );
}
