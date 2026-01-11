'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function CallbackClient() {
  const search = useSearchParams();
  const router = useRouter();

  const redirect = decodeURIComponent(search.get('redirect') || '/');
  const code = search.get('code');

  useEffect(() => {
    (async () => {
      try {
        if (!code) {
          router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
          return;
        }
        // Your installed SDK expects a string
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('OAuth exchange error:', error.message);
          router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}&error=oob_exchange_failed`);
          return;
        }
        router.replace(redirect || '/');
      } catch (e) {
        console.error(e);
        router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}&error=unexpected`);
      }
    })();
  }, [code, redirect, router]);

  return <p>Signing you in…</p>;
}
