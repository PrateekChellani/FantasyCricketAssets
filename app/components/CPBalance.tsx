'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SUPABASE_STORAGE_KEY } from '../lib/supabaseClient';

type WalletRow = {
  user_id: string;
  cp_balance: number;
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)');
  return { url: url.replace(/\/$/, ''), anon };
}

function readAuthFromStorage(): { access_token: string; user_id: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SUPABASE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    const access_token =
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      parsed?.data?.session?.access_token;

    const user_id =
      parsed?.user?.id ||
      parsed?.currentSession?.user?.id ||
      parsed?.session?.user?.id ||
      parsed?.data?.session?.user?.id;

    if (!access_token || !user_id) return null;
    return { access_token, user_id };
  } catch {
    return null;
  }
}

export default function CPBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);

    try {
      const auth = readAuthFromStorage();
      if (!auth) {
        setBalance(null);
        return;
      }

      const { url, anon } = getSupabaseEnv();

      // ✅ Option A: use PUBLIC wrapper view
      const endpoint =
        `${url}/rest/v1/v_user_cp_wallets` +
        `?select=user_id,cp_balance&user_id=eq.${encodeURIComponent(auth.user_id)}&limit=1`;

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${auth.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(`CP wallet fetch failed (${resp.status}): ${text || resp.statusText}`);

      const json = (text ? JSON.parse(text) : []) as WalletRow[];
      const row = json?.[0];

      setBalance(typeof row?.cp_balance === 'number' ? row.cp_balance : 0);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load CP');
      setBalance(null);
    }
  };

  useEffect(() => {
    load();

    const onChanged = () => load();
    window.addEventListener('cp:changed', onChanged);
    return () => window.removeEventListener('cp:changed', onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href="/profile/ledger"
      title={err ? `CP Error: ${err}` : 'View CP Ledger'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        border: '1px solid #eee',
        borderRadius: 999,
        textDecoration: 'none',
        color: 'inherit',
        background: '#fff',
      }}
    >
      <img
        src="https://fantasy-cricket-assets.vercel.app/assets/cp.png"
        alt="CP"
        width={18}
        height={18}
        style={{ display: 'block' }}
      />
      <span style={{ fontWeight: 700, fontSize: 13 }}>
        {balance === null ? '—' : `${balance} CP`}
      </span>
    </Link>
  );
}
