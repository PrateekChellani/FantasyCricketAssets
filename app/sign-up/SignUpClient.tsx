'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function SignUpClient() {
  const search = useSearchParams();
  const redirect = decodeURIComponent(search.get('redirect') || '/');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Always send people to onboarding after auth completes
  const onboardingRedirect = `/onboarding?next=${encodeURIComponent(redirect)}`;

  // -----------------------------
  // styling (match onboarding page)
  // -----------------------------
  const btnPrimary: React.CSSProperties = {
    width: '100%',
    borderRadius: 12,
    border: '1px solid #111',
    background: '#111',
    color: '#fff',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
  };

  const btnGhost: React.CSSProperties = {
    width: '100%',
    borderRadius: 12,
    border: '1px solid #e5e5e5',
    background: '#fff',
    color: '#111',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #e5e5e5',
    background: '#fff',
    fontSize: 14,
    outline: 'none',
  };

  // Always keep functionality the same
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);

    if (password !== confirm) {
      setMsg('Passwords do not match.');
      return;
    }

    setBusy(true);
    const clean = username.trim();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(onboardingRedirect)}`,
        data: { display_name: clean, full_name: clean },
      },
    });

    setBusy(false);
    if (error) setMsg(error.message);
    else setOk('Account created. Check your email to verify, then you’ll be taken to onboarding.');
  }

  async function signUpWithGoogle() {
    setMsg(null);
    setOk(null);

    const clean = username.trim();

    const cb = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(onboardingRedirect)}${
      clean ? `&username=${encodeURIComponent(clean)}` : ''
    }`;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: cb },
    });
  }

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Banner messages */}
      {msg ? (
        <div
          style={{
            marginBottom: 12,
            background: '#fee2e2',
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
            color: '#991b1b',
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      {ok ? (
        <div
          style={{
            marginBottom: 12,
            background: '#d1fae5',
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
            color: '#065f46',
            fontWeight: 800,
          }}
        >
          {ok}
        </div>
      ) : null}

      {/* Google */}
      <button
        onClick={signUpWithGoogle}
        disabled={busy}
        style={{
          ...btnGhost,
          opacity: busy ? 0.6 : 1,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        Sign Up with Google
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
        <div style={{ height: 1, background: '#eee', flex: 1 }} />
        <div style={{ fontSize: 12, color: '#777', fontWeight: 900 }}>OR</div>
        <div style={{ height: 1, background: '#eee', flex: 1 }} />
      </div>

      {/* Email signup */}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Username</div>
          <input
            type="text"
            placeholder="UserName"
            autoComplete="nickname"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ ...input, marginTop: 6 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Email</div>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...input, marginTop: 6 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Password</div>
            <input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...input, marginTop: 6 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Confirm</div>
            <input
              type="password"
              placeholder="Confirm Password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ ...input, marginTop: 6 }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            ...btnPrimary,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
        Already have an account?{' '}
        <a href={`/sign-in?redirect=${encodeURIComponent(redirect)}`} style={{ fontWeight: 900, color: '#111' }}>
          Sign-In
        </a>
      </p>
    </div>
  );
}
