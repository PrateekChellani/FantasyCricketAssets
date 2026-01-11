'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SUPABASE_STORAGE_KEY } from '../lib/supabaseClient';

type GridRow = {
  streak_day: number;
  cp_reward: number;
  today_ist: string;
  claimed_today: boolean;
  claimable_streak_day: number;
  has_claim_row_today: boolean;
  is_claimable_today: boolean;
  is_future_greyed: boolean;
};

const DAILY_ICON = 'https://fantasy-cricket-assets.vercel.app/assets/daily_login.png';
const CP_ICON = 'https://fantasy-cricket-assets.vercel.app/assets/cp.png';

function withTimeout<T>(fn: () => Promise<T> | T, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    Promise.resolve()
      .then(() => fn())
      .then((v) => {
        clearTimeout(t);
        resolve(v as T);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
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

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)');
  return { url: url.replace(/\/$/, ''), anon };
}

export default function DailyLoginButton() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const claimedToday = useMemo(
    () => rows.some((r) => r.claimed_today || r.has_claim_row_today),
    [rows]
  );

  const loadGrid = async () => {
    setErr(null);
    setToast(null);
    setLoading(true);

    try {
      const auth = readAuthFromStorage();
      if (!auth) throw new Error('Please sign in to view daily login rewards.');

      const { url, anon } = getSupabaseEnv();
      const endpoint = `${url}/rest/v1/v_my_login_bonus_grid?select=*&order=streak_day.asc`;

      const resp = await withTimeout(
        () =>
          fetch(endpoint, {
            method: 'GET',
            headers: {
              apikey: anon,
              Authorization: `Bearer ${auth.access_token}`,
              'Content-Type': 'application/json',
            },
          }),
        8000,
        'grid fetch'
      );

      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(`Grid request failed (${resp.status}): ${text || resp.statusText}`);

      const json = (text ? JSON.parse(text) : []) as GridRow[];
      setRows(json ?? []);
    } catch (e: any) {
      console.error('[DailyLogin] loadGrid failed', e);
      setRows([]);
      setErr(e?.message ?? 'Failed to load daily login');
    } finally {
      setLoading(false);
    }
  };

  const claimToday = async () => {
    setErr(null);
    setToast(null);
    setClaiming(true);

    try {
      const auth = readAuthFromStorage();
      if (!auth) throw new Error('Please sign in to claim.');

      const { url, anon } = getSupabaseEnv();
      const endpoint = `${url}/rest/v1/rpc/claim_login_bonus`;

      const resp = await withTimeout(
        () =>
          fetch(endpoint, {
            method: 'POST',
            headers: {
              apikey: anon,
              Authorization: `Bearer ${auth.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_user_id: auth.user_id }),
          }),
        8000,
        'claim_login_bonus RPC'
      );

      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(`Claim failed (${resp.status}): ${text || resp.statusText}`);

      const data = text ? JSON.parse(text) : null;
      const first = Array.isArray(data) ? data[0] : data;
      const awarded = first?.cp_awarded ?? null;

      setToast(awarded !== null ? `Claimed +${awarded} CP ✅` : 'Claimed ✅');

      await loadGrid();
      window.dispatchEvent(new Event('cp:changed'));
    } catch (e: any) {
      console.error('[DailyLogin] claim failed', e);
      setErr(e?.message ?? 'Failed to claim');
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Daily Login"
        aria-label="Daily Login"
        style={{
          border: '1px solid #eee',
          background: '#fff',
          borderRadius: 999,
          padding: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <img src={DAILY_ICON} alt="" width={26} height={26} style={{ display: 'block' }} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1100px, 96vw)',
              height: 'min(760px, 92vh)',
              background: '#0b1220',
              color: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <strong style={{ fontSize: 16 }}>Daily Login</strong>
                <span style={{ opacity: 0.75, fontSize: 13 }}>
                  {claimedToday ? 'Claimed today' : 'Claim today’s reward'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 18, flex: 1, overflow: 'auto' }}>
              {toast && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(34,197,94,0.16)',
                    border: '1px solid rgba(34,197,94,0.35)',
                    color: '#fff',
                    fontSize: 13,
                  }}
                >
                  {toast}
                </div>
              )}

              {err && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(220,38,38,0.18)',
                    border: '1px solid rgba(220,38,38,0.35)',
                    color: '#fff',
                    fontSize: 13,
                  }}
                >
                  {err}
                </div>
              )}

              {loading ? (
                <div style={{ opacity: 0.8 }}>Loading…</div>
              ) : (
                <>
                  <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={claimToday}
                      disabled={claiming || claimedToday || !rows.some((r) => r.is_claimable_today)}
                      style={{
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: claimedToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
                        color: '#fff',
                        borderRadius: 10,
                        padding: '8px 12px',
                        cursor: claimedToday ? 'default' : 'pointer',
                      }}
                    >
                      {claimedToday ? 'Already claimed today' : claiming ? 'Claiming…' : 'Claim today'}
                    </button>

                    <button
                      type="button"
                      onClick={loadGrid}
                      disabled={claiming || loading}
                      style={{
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        borderRadius: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14 }}>
                    {rows.map((r) => {
                      // Use the streak marker from the grid to decide what's already earned.
                      // - Any day < claimable_streak_day is definitely claimed (past days in the streak)
                      // - The day == claimable_streak_day is claimed if the user has already claimed today
                      const streakNow = r.claimable_streak_day ?? 0;
                      const isClaimed = r.streak_day < streakNow || (r.streak_day === streakNow && (r.claimed_today || r.has_claim_row_today));

                      // Only allow/pulse the claimable day if it's not yet claimed and not future-greyed
                      const highlight = r.is_claimable_today && !isClaimed && !r.is_future_greyed;

                      // Future days should remain greyed (and not green)
                      const isFuture = r.is_future_greyed;

                      return (
                        <div key={r.streak_day}>
                          <button
                            type="button"
                            disabled={!highlight || claiming}
                            onClick={highlight ? claimToday : undefined}
                            className={highlight ? 'dl-box dl-pulse' : 'dl-box'}
                            style={{
                              width: '100%',
                              aspectRatio: '1 / 1',
                              borderRadius: 14,
                              border: highlight
                                ? '1px solid rgba(255,255,255,0.55)'
                                : isClaimed && !isFuture
                                  ? '1px solid rgba(34,197,94,0.45)'
                                  : '1px solid rgba(255,255,255,0.14)',
                              background: isClaimed && !isFuture
                                ? 'rgba(34,197,94,0.16)'
                                : isFuture
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(255,255,255,0.10)',
                              cursor: highlight ? 'pointer' : 'default',
                              opacity: isFuture ? 0.35 : 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              padding: 12,
                            }}
                          >
                            <img
                              src={CP_ICON}
                              alt="CP"
                              style={{
                                display: 'block',
                                width: '88%',
                                height: '88%',
                                objectFit: 'contain',
                              }}
                            />
                            <div style={{ fontWeight: 800, fontSize: 16 }}>+{r.cp_reward} CP</div>
                          </button>

                          <div style={{ marginTop: 8, textAlign: 'center', fontSize: 13, opacity: 0.85 }}>
                            Day {r.streak_day === 10 ? '10+' : r.streak_day}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dl-box.dl-pulse {
          animation: dlPulse 1.6s ease-in-out infinite;
        }
        @keyframes dlPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 22px 3px rgba(59, 130, 246, 0.3);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
