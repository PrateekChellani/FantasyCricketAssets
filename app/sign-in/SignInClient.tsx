'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function SignInClient() {
  const search = useSearchParams();
  const router = useRouter();
  const redirect = decodeURIComponent(search.get('redirect') || '/');
  const code = search.get('code'); // <-- may be present after Google

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already logged in, bounce
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(redirect);
    })();
  }, [redirect, router]);

  // If provider sent us back to /sign-in with ?code=..., finish the PKCE exchange here.
  useEffect(() => {
    (async () => {
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('OAuth exchange error:', error.message);
        setMsg(error.message);
        return;
      }
      router.replace(redirect || '/');
    })();
  }, [code, redirect, router]);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace(redirect || '/');
  }

  async function signInGoogle() {
    setMsg(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
      }
    });
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <button onClick={signInGoogle} disabled={busy}>Continue with Google</button>
      <hr />
      <form onSubmit={signInEmail}>
        <input type="email" placeholder="Email" autoComplete="email"
               required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" autoComplete="current-password"
               required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy}>Sign in</button>
      </form>

      <p style={{ marginTop: 8 }}>
        Don&apos;t have an account?{' '}
        <a href={`/sign-up?redirect=${encodeURIComponent(redirect)}`}>Join Now!</a>
      </p>

      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
    </div>
  );
}
