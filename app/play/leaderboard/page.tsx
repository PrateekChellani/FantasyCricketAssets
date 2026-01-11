'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  last_login_at: string | null;
  competition_wins: number | null;
  suspended_at: string | null;
  cp_balance: number | string | null; // ✅ added (read from v_user_profiles)
};

type CardOwnershipRow = {
  user_id: string;
  is_current: boolean;
  is_active: boolean;
};

type CpWalletRow = {
  user_id: string;
  cp_balance: number | string | null;
};

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  competition_wins: number;
  cp_balance: number;
  cards_active: number;
  last_login_at: string | null;
};

type SortKey = 'competition_wins' | 'cp_balance' | 'cards_active';

function coerceNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatLastLogin(ts: string | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/**
 * Source CP from the same location as the CPBalance pill:
 * public.v_user_cp_wallets
 */
async function fetchCpBalanceMap(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('v_user_cp_wallets')
    .select('user_id, cp_balance')
    .limit(5000);

  if (error) throw error;

  const map: Record<string, number> = {};
  (data as CpWalletRow[]).forEach((r) => {
    map[r.user_id] = coerceNumber(r.cp_balance);
  });

  return map;
}

export default function PlayLeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Descending-only sorts, per requirement
  const [sortKey, setSortKey] = useState<SortKey>('competition_wins');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) Profiles (exclude suspended users)
        const { data: profiles, error: profilesErr } = await supabase
          .from('v_user_profiles')
          .select('user_id, display_name, last_login_at, competition_wins, suspended_at, cp_balance')
          .is('suspended_at', null)
          .limit(5000);

        if (profilesErr) throw profilesErr;

        // 2) Cards (active + current)
        const { data: ownership, error: ownershipErr } = await supabase
          .from('card_ownership')
          .select('user_id, is_current, is_active')
          .eq('is_current', true)
          .eq('is_active', true)
          .limit(200000);

        if (ownershipErr) throw ownershipErr;

        // 3) CP balances (from v_user_cp_wallets)
        const cpMap = await fetchCpBalanceMap();

        // Build cards count map
        const cardCountMap: Record<string, number> = {};
        (ownership as CardOwnershipRow[]).forEach((r) => {
          cardCountMap[r.user_id] = (cardCountMap[r.user_id] || 0) + 1;
        });

        // Assemble rows
        const out: LeaderboardRow[] = (profiles as UserProfileRow[]).map((p) => {
          const dn = (p.display_name || 'User').trim();
          return {
            user_id: p.user_id,
            display_name: dn.length ? dn : 'User',
            competition_wins: coerceNumber(p.competition_wins),
            cp_balance: coerceNumber(p.cp_balance), // ✅ changed: read directly from v_user_profiles
            cards_active: coerceNumber(cardCountMap[p.user_id]),
            last_login_at: p.last_login_at ?? null,
          };
        });

        if (!cancelled) setRows(out);
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message || 'Failed to load leaderboard.');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    // Descending-only for sortKey
    copy.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

    // Stable tie-break: display_name asc
    copy.sort((a, b) => {
      const primary = (b[sortKey] as number) - (a[sortKey] as number);
      if (primary !== 0) return primary;
      return a.display_name.localeCompare(b.display_name);
    });

    return copy;
  }, [rows, sortKey]);

  const headerBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    opacity: 0.85,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    verticalAlign: 'middle',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 1100,
    margin: '0 auto',
    padding: 16,
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Leaderboard</div>
          <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
            Sortable (descending only): Competition Wins, Cover Points, Cards
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading && <div style={{ opacity: 0.8 }}>Loading…</div>}

        {!loading && errorMsg && (
          <div style={{ padding: 12, border: '1px solid rgba(255,0,0,0.25)', borderRadius: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Failed to load leaderboard</div>
            <div style={{ opacity: 0.85 }}>{errorMsg}</div>
          </div>
        )}

        {!loading && !errorMsg && (
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>

                  <th style={thStyle}>
                    <button
                      style={headerBtnStyle}
                      onClick={() => setSortKey('competition_wins')}
                      title="Sort by Competition Wins (descending)"
                    >
                      Competition Wins {sortKey === 'competition_wins' ? '↓' : ''}
                    </button>
                  </th>

                  <th style={thStyle}>
                    <button
                      style={headerBtnStyle}
                      onClick={() => setSortKey('cp_balance')}
                      title="Sort by Cover Points (descending)"
                    >
                      Cover Points {sortKey === 'cp_balance' ? '↓' : ''}
                    </button>
                  </th>

                  <th style={thStyle}>
                    <button
                      style={headerBtnStyle}
                      onClick={() => setSortKey('cards_active')}
                      title="Sort by Cards (descending)"
                    >
                      Cards {sortKey === 'cards_active' ? '↓' : ''}
                    </button>
                  </th>

                  <th style={thStyle}>Last log-in</th>
                </tr>
              </thead>

              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      <div style={{ opacity: 0.8 }}>No users found.</div>
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => (
                    <tr key={r.user_id}>
                      <td style={tdStyle}>
                        <Link
                          href={`/profile/${encodeURIComponent(r.display_name)}`}
                          style={{ fontWeight: 900, textDecoration: 'none' }}
                          title={`View ${r.display_name}'s profile`}
                        >
                          {r.display_name}
                        </Link>
                      </td>

                      <td style={tdStyle}>{r.competition_wins}</td>
                      <td style={tdStyle}>{r.cp_balance}</td>
                      <td style={tdStyle}>{r.cards_active}</td>
                      <td style={tdStyle}>{formatLastLogin(r.last_login_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
