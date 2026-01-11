'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

/** Detail grain from public.v_player_match_points_detail */
type PointsDetailRow = {
  match_id: number;
  player_id: number;
  player_full_name: string | null;
  active: boolean | null;
  team_id: number | null;
  team_name: string | null;

  match_date: string | null;
  competition: string | null;
  venue: string | null;
  format: string | null;

  points_total: number | null;
  points_batting: number | null;
  points_bowling: number | null;
  points_fielding: number | null;
  points_misc: number | null;
};

type LeaderRow = {
  player_id: number;
  player_full_name: string;
  team_name: string | null;
  active: boolean;
  total_points: number;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  misc_points: number;
};

type SortKey =
  | 'player_full_name'
  | 'team_name'
  | 'total_points'
  | 'batting_points'
  | 'bowling_points'
  | 'fielding_points'
  | 'misc_points';

type SortDir = 'asc' | 'desc';

const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
};
const Th: React.FC<React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>> = ({
  children,
  style,
  ...rest
}) => (
  <th style={{ ...thTdBase, fontWeight: 700, ...(style || {}) }} {...rest}>
    {children}
  </th>
);
const Td: React.FC<React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>> = ({
  children,
  style,
  ...rest
}) => (
  <td style={{ ...thTdBase, ...(style || {}) }} {...rest}>
    {children}
  </td>
);

export default function PlayerLeaderboardPage() {
  const [raw, setRaw] = useState<PointsDetailRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [qPlayer, setQPlayer] = useState('');
  const [qTeam, setQTeam] = useState('');
  const [qCompetition, setQCompetition] = useState('');
  const [qVenue, setQVenue] = useState('');
  const [qFormat, setQFormat] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('total_points');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'player_full_name' || key === 'team_name' ? 'asc' : 'desc');
    }
  };
  const sortIndicator = (key: SortKey) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from('v_player_match_points_detail')
        .select(
          'match_id, player_id, player_full_name, active, team_id, team_name, match_date, competition, venue, format, points_total, points_batting, points_bowling, points_fielding, points_misc'
        )
        .order('match_date', { ascending: false });

      if (error) {
        setErr(error.message);
        setRaw([]);
      } else {
        setRaw(data as PointsDetailRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const formatOptions = useMemo(() => {
    const s = new Set<string>();
    raw.forEach((r) => {
      if (r.format) s.add(r.format);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [raw]);

  // Filter rows
  const filtered = useMemo(() => {
    return raw.filter((r) => {
      if (activeOnly && r.active === false) return false;

      if (qPlayer.trim()) {
        const hay = (r.player_full_name ?? '').toLowerCase();
        if (!hay.includes(qPlayer.toLowerCase())) return false;
      }
      if (qTeam.trim()) {
        const hay = (r.team_name ?? '').toLowerCase();
        if (!hay.includes(qTeam.toLowerCase())) return false;
      }
      if (qCompetition.trim()) {
        const hay = (r.competition ?? '').toLowerCase();
        if (!hay.includes(qCompetition.toLowerCase())) return false;
      }
      if (qVenue.trim()) {
        const hay = (r.venue ?? '').toLowerCase();
        if (!hay.includes(qVenue.toLowerCase())) return false;
      }
      if (qFormat && r.format !== qFormat) return false;

      if (dateFrom && (r.match_date ?? '') < dateFrom) return false;
      if (dateTo && (r.match_date ?? '') > dateTo) return false;

      return true;
    });
  }, [raw, activeOnly, qPlayer, qTeam, qCompetition, qVenue, qFormat, dateFrom, dateTo]);

  // Aggregate to player level and rank
  const tableRows = useMemo<LeaderRow[]>(() => {
    const map = new Map<number, LeaderRow>();
    for (const r of filtered) {
      const id = r.player_id;
      if (!map.has(id)) {
        map.set(id, {
          player_id: id,
          player_full_name: r.player_full_name ?? `Player ${id}`,
          team_name: r.team_name ?? null,
          active: !!r.active,
          total_points: 0,
          batting_points: 0,
          bowling_points: 0,
          fielding_points: 0,
          misc_points: 0,
        });
      }
      const acc = map.get(id)!;
      acc.total_points += r.points_total ?? 0;
      acc.batting_points += r.points_batting ?? 0;
      acc.bowling_points += r.points_bowling ?? 0;
      acc.fielding_points += r.points_fielding ?? 0;
      acc.misc_points += r.points_misc ?? 0;
    }
    const arr = Array.from(map.values());

    // Sort by selected column
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const sval = (k: SortKey, x: LeaderRow) => {
        switch (k) {
          case 'player_full_name':
            return x.player_full_name ?? '';
          case 'team_name':
            return x.team_name ?? '';
          case 'total_points':
            return x.total_points;
          case 'batting_points':
            return x.batting_points;
          case 'bowling_points':
            return x.bowling_points;
          case 'fielding_points':
            return x.fielding_points;
          case 'misc_points':
            return x.misc_points;
        }
      };
      const av = sval(sortKey, a) as any;
      const bv = sval(sortKey, b) as any;
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir * av.localeCompare(bv);
      }
      return dir * ((av as number) - (bv as number));
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  return (
    <div style={{ display: 'flex', minHeight: '70vh' }}>
      {/* Drawer toggle */}
      <button
        aria-label="Filters"
        onClick={() => setDrawerOpen((s) => !s)}
        style={{
          position: 'fixed',
          left: 8,
          top: 96,
          zIndex: 5,
          padding: '6px 10px',
          border: '1px solid #ddd',
          background: '#fff',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {drawerOpen ? '« Filters' : '» Filters'}
      </button>

      {/* Filter drawer */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 80,
          bottom: 0,
          zIndex: 6,

          width: drawerOpen ? 640 : 0, // approx double, overlays instead of shrinking table
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          borderRight: drawerOpen ? '1px solid #eee' : 'none',
          padding: drawerOpen ? '16px' : 0,
          background: '#fafafa',
          boxShadow: drawerOpen ? '0 10px 30px rgba(0,0,0,0.18)' : 'none',
        }}
      >
        <div style={{ height: '100%', overflowY: 'auto' }}>
          {/* Collapse button inside panel (so user can close it from the open drawer) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              aria-label="Close filters"
              onClick={() => setDrawerOpen(false)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              × Close
            </button>
          </div>

          <h3 style={{ marginTop: 0 }}>Filters</h3>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Player Name</label>
            <input
              value={qPlayer}
              onChange={(e) => setQPlayer(e.target.value)}
              placeholder="Type player…"
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Team</label>
            <input
              value={qTeam}
              onChange={(e) => setQTeam(e.target.value)}
              placeholder="Type team…"
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Competition</label>
            <input
              value={qCompetition}
              onChange={(e) => setQCompetition(e.target.value)}
              placeholder="Type competition…"
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Venue</label>
            <input
              value={qVenue}
              onChange={(e) => setQVenue(e.target.value)}
              placeholder="Type venue…"
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Format</label>
            <select
              value={qFormat}
              onChange={(e) => setQFormat(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            >
              <option value="">All</option>
              {formatOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600 }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600 }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active players only
          </label>
        </div>
      </aside>

      {/* Main table */}
      <main style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ marginTop: 0 }}>Player Leaderboard</h1>
        {err ? (
          <div style={{ color: 'crimson' }}>Failed to load: {err}</div>
        ) : loading ? (
          <div>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <Th style={{ width: 80 }}>Ranking</Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('player_full_name')}>
                    Player{sortIndicator('player_full_name')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('team_name')}>
                    Team{sortIndicator('team_name')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('total_points')}>
                    Total Points{sortIndicator('total_points')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('batting_points')}>
                    Batting{sortIndicator('batting_points')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('bowling_points')}>
                    Bowling{sortIndicator('bowling_points')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('fielding_points')}>
                    Fielding{sortIndicator('fielding_points')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('misc_points')}>
                    Misc{sortIndicator('misc_points')}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, idx) => (
                  <tr key={r.player_id}>
                    <Td>{idx + 1}</Td>
                    <Td>
                      <Link href={`/players/${r.player_id}`} style={{ textDecoration: 'underline' }}>
                        {r.player_full_name}
                      </Link>
                    </Td>
                    <Td>{r.team_name ?? ''}</Td>
                    <Td>{r.total_points}</Td>
                    <Td>{r.batting_points}</Td>
                    <Td>{r.bowling_points}</Td>
                    <Td>{r.fielding_points}</Td>
                    <Td>{r.misc_points}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
