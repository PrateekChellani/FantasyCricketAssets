'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import SignInPopUp from './SignInPopUp';

type UserInfo = {
  user_id: string;
  displayName?: string; // optional; if absent we show avatar only
  avatarUrl?: string | null;
} | null;

type ProfileRow = {
  display_name: string | null;
};

function pickString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

export default function AuthStatus() {
  const router = useRouter();
  const [me, setMe] = useState<UserInfo>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const u = data.user;

      if (!u) {
        setMe(null);
        return;
      }

      // Priority: auth metadata first
      const md = (u.user_metadata || {}) as Record<string, unknown>;

      const authDisplayName =
        pickString(md.display_name) ??
        pickString(md.username);

      const avatarUrl =
        pickString(md.avatar_url) ??
        pickString(md.picture) ??
        null;

      // If we already have a name from auth metadata, use it and DON'T touch emails/full names
      if (authDisplayName) {
        setMe({
          user_id: u.id,
          displayName: authDisplayName,
          avatarUrl,
        });
        return;
      }

      // Fallback: query v_user_profiles.display_name
      const { data: profile, error } = await supabase
        .from('v_user_profiles')
        .select('display_name')
        .eq('user_id', u.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        // If this fails, still show avatar only (never email/name)
        setMe({
          user_id: u.id,
          avatarUrl,
        });
        return;
      }

      const profileDisplayName = pickString((profile as ProfileRow | null)?.display_name);

      setMe({
        user_id: u.id,
        displayName: profileDisplayName, // may be undefined -> avatar only
        avatarUrl,
      });
    } catch {
      // On any unexpected error, do NOT show email/name; just treat as logged out
      setMe(null);
    }
  };

  // hydrate user on mount + react to auth changes
  useEffect(() => {
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
      router.refresh();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    setMe(null);
    router.refresh();
  }

  const profileHref = useMemo(() => {
    return '/profile';
  }, []);

  const Avatar = (
    <>
      {me?.avatarUrl ? (
        <img
          src={me.avatarUrl}
          alt="Avatar"
          width={26}
          height={26}
          style={{ borderRadius: 999, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Avatar"
        >
          {/* simple generic user icon (no initials) */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 21a8 8 0 0 0-16 0"
              stroke="#374151"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M12 13a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z"
              stroke="#374151"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </>
  );

  if (me) {
    // If no displayName, show avatar only (still keep Sign out button)
    const content = (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}>
        {Avatar}
        {me.displayName ? <span>{me.displayName}</span> : null}
      </div>
    );

    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link
          href={profileHref}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 800,
          }}
          title="View profile"
        >
          {content}
        </Link>

        <button
          onClick={signOut}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #ccc',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Sign In
      </button>
      <SignInPopUp open={open} onClose={() => setOpen(false)} />
    </>
  );
}
