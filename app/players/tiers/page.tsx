'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type POS = {
  player_id: number;
  player_full_name: string;
  matches_played: number;
  total_runs_scored: number;
  total_wickets_taken: number;
  avg_strike_rate: number | null;
  avg_economy_rate: number | null;
};

type POPT = {
  player_id: number;
  total_points: number;
  total_batting_points: number;
  total_bowling_points: number;
  total_fielding_points: number;
  avg_points_per_game: number | null;
};

type HDR = {
  player_id: number;
  player_full_name: string;
  tier: string | null;
};

type Row = POS &
  POPT & {
    tier: string | null;
  };

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
};
const thtd: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 14,
};
const head: React.CSSProperties = { background: '#fafafa' };

export default function PlayersTiersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        // fetch all three views
        const [posRes, poptRes, hdrRes] = await Promise.all([
          supabase.from('v_player_overall_stats').select('*'),
          supabase.from('v_player_overall_point_totals').select('*'),
          supabase.from('v_player_profile_header').select('player_id, player_full_name, tier'),
        ]);

        if (posRes.error) throw posRes.error;
        if (poptRes.error) throw poptRes.error;
        if (hdrRes.error) throw hdrRes.error;

        const pos = (posRes.data ?? []) as POS[];
        const poptMap = new Map<number, POPT>((poptRes.data ?? []).map((r: any) => [r.player_id, r]));
        const hdrMap = new Map<number, HDR>((hdrRes.data ?? []).map((r: any) => [r.player_id, r]));

        const merged: Row[] = pos.map((p) => {
          const pv = poptMap.get(p.player_id);
          const hv = hdrMap.get(p.player_id);
          return {
            ...p,
            total_points: pv?.total_points ?? 0,
            total_batting_points: pv?.total_batting_points ?? 0,
            total_bowling_points: pv?.total_bowling_points ?? 0,
            total_fielding_points: pv?.total_fielding_points ?? 0,
            avg_points_per_game: pv?.avg_points_per_game ?? 0,
            tier: hv?.tier ?? null,
          };
        });

        setRows(merged);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load tiers');
        setRows([]);
      }
    })();
  }, []);

  // group by tier for collapsible sections
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const key = (r.tier ?? 'Unrated').toString();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }

    // sort each group by total points desc
    for (const [k, arr] of m) {
      arr.sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
      m.set(k, arr);
    }

    // order group keys: S, A, B, C, D, Unrated
    const order = ['S', 'A', 'B', 'C', 'D', 'Unrated'];
    const keys = Array.from(m.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return { keys, map: m };
  }, [rows]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ marginTop: 0 }}>Players by Tier</h1>

      {err && <div style={{ color: 'crimson', marginTop: 10 }}>{err}</div>}

      {groups.keys.map((tierKey) => {
        const list = groups.map.get(tierKey)!;

        // default open: S and A (tweak as you like)
        const defaultOpen = tierKey === 'S' || tierKey === 'A';

        return (
          <div key={tierKey} style={{ ...card, marginTop: 14 }}>
            <details open={defaultOpen}>
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 10,
                  userSelect: 'none',
                }}
              >
                <span>
                  Tier {tierKey}{' '}
                  <span style={{ opacity: 0.6, fontWeight: 500 }}>({list.length})</span>
                </span>
              </summary>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead style={head}>
                    <tr>
                      <th style={thtd}>#</th>
                      <th style={thtd}>Player</th>
                      <th style={thtd}>Mat</th>
                      <th style={thtd}>Runs</th>
                      <th style={thtd}>Wkts</th>
                      <th style={thtd}>Avg SR</th>
                      <th style={thtd}>Avg ER</th>
                      <th style={thtd}>Total Pts</th>
                      <th style={thtd}>Bat Pts</th>
                      <th style={thtd}>Bowl Pts</th>
                      <th style={thtd}>Field Pts</th>
                      <th style={thtd}>Avg Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r, i) => (
                      <tr key={r.player_id}>
                        <td style={thtd}>{i + 1}</td>
                        <td style={thtd}>
                          <Link href={`/players/${r.player_id}`} style={{ textDecoration: 'underline' }}>
                            {r.player_full_name}
                          </Link>
                        </td>
                        <td style={thtd}>{r.matches_played}</td>
                        <td style={thtd}>{r.total_runs_scored}</td>
                        <td style={thtd}>{r.total_wickets_taken}</td>
                        <td style={thtd}>{r.avg_strike_rate ?? '-'}</td>
                        <td style={thtd}>{r.avg_economy_rate ?? '-'}</td>
                        <td style={thtd}>{r.total_points ?? 0}</td>
                        <td style={thtd}>{r.total_batting_points ?? 0}</td>
                        <td style={thtd}>{r.total_bowling_points ?? 0}</td>
                        <td style={thtd}>{r.total_fielding_points ?? 0}</td>
                        <td style={thtd}>{r.avg_points_per_game ?? '-'}</td>
                      </tr>
                    ))}

                    {list.length === 0 && (
                      <tr>
                        <td style={thtd} colSpan={12}>
                          &mdash; No players in this tier &mdash;
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })}

      {groups.keys.length === 0 && (
        <div style={{ ...card, marginTop: 12, opacity: 0.7 }}>No players found.</div>
      )}
    </div>
  );
}
