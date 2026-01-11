'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

/** Detail grain from public.v_player_match_stats_detail */
type StatDetailRow = {
  match_id: number;
  player_id: number;
  player_full_name: string | null;
  active: boolean | null;
  team_id: number | null;
  team_name: string | null;

  match_date: string | null; // ISO date
  competition: string | null;
  venue: string | null;
  format: string | null;

  runs_scored: number | null;
  wickets_taken: number | null;
  catches_taken: number | null;
  runouts_stumpings: number | null;
  strike_rate: number | null;
  economy_rate: number | null;
  is_man_of_the_match: boolean | null;
};

type ScorecardRow = {
  player_id: number;
  player_full_name: string;
  team_name: string | null;
  active: boolean;

  matches_played: number;
  runs_scored: number;
  wickets_taken: number;
  catches_taken: number;
  runouts_stumpings: number;
  motms: number;
};

type SortKey =
  | 'player_full_name'
  | 'team_name'
  | 'matches_played'
  | 'runs_scored'
  | 'wickets_taken'
  | 'catches_taken'
  | 'runouts_stumpings'
  | 'motms';

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

export default function PlayerScorecardPage() {
  const [raw, setRaw] = useState<StatDetailRow[]>([]);
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
  const [sortKey, setSortKey] = useState<SortKey>('runs_scored');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // sensible default: text asc, numbers desc
      setSortDir(key === 'player_full_name' || key === 'team_name' ? 'asc' : 'desc');
    }
  };
  const sortIndicator = (key: SortKey) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  // Load all detail rows (client filters + aggregation)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from('v_player_match_stats_detail')
        .select(
          'match_id, player_id, player_full_name, active, team_id, team_name, match_date, competition, venue, format, runs_scored, wickets_taken, catches_taken, runouts_stumpings, strike_rate, economy_rate, is_man_of_the_match'
        )
        .order('match_date', { ascending: false });

      if (error) {
        setErr(error.message);
        setRaw([]);
      } else {
        setRaw(data as StatDetailRow[]);
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

  // Apply filters (client-side)
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

  // Aggregate to player level
  const tableRows = useMemo<ScorecardRow[]>(() => {
    const map = new Map<number, ScorecardRow>();
    for (const r of filtered) {
      const id = r.player_id;
      if (!map.has(id)) {
        map.set(id, {
          player_id: id,
          player_full_name: r.player_full_name ?? `Player ${id}`,
          team_name: r.team_name ?? null,
          active: !!r.active,
          matches_played: 0,
          runs_scored: 0,
          wickets_taken: 0,
          catches_taken: 0,
          runouts_stumpings: 0,
          motms: 0,
        });
      }
      const acc = map.get(id)!;
      acc.matches_played += 1;
      acc.runs_scored += r.runs_scored ?? 0;
      acc.wickets_taken += r.wickets_taken ?? 0;
      acc.catches_taken += r.catches_taken ?? 0;
      acc.runouts_stumpings += r.runouts_stumpings ?? 0;
      acc.motms += r.is_man_of_the_match ? 1 : 0;
    }
    const arr = Array.from(map.values());

    // Sort
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const sval = (k: SortKey, x: ScorecardRow) => {
        switch (k) {
          case 'player_full_name':
            return x.player_full_name ?? '';
          case 'team_name':
            return x.team_name ?? '';
          case 'matches_played':
            return x.matches_played;
          case 'runs_scored':
            return x.runs_scored;
          case 'wickets_taken':
            return x.wickets_taken;
          case 'catches_taken':
            return x.catches_taken;
          case 'runouts_stumpings':
            return x.runouts_stumpings;
          case 'motms':
            return x.motms;
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
        <h1 style={{ marginTop: 0 }}>Player Scorecard</h1>
        {err ? (
          <div style={{ color: 'crimson' }}>Failed to load: {err}</div>
        ) : loading ? (
          <div>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('player_full_name')}>
                    Player{sortIndicator('player_full_name')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('team_name')}>
                    Team{sortIndicator('team_name')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('matches_played')}>
                    Matches{sortIndicator('matches_played')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('runs_scored')}>
                    Runs{sortIndicator('runs_scored')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('wickets_taken')}>
                    Wickets{sortIndicator('wickets_taken')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('catches_taken')}>
                    Catches{sortIndicator('catches_taken')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('runouts_stumpings')}>
                    Run Outs / Stumpings{sortIndicator('runouts_stumpings')}
                  </Th>
                  <Th style={{ cursor: 'pointer' }} onClick={() => handleSort('motms')}>
                    MoTM{sortIndicator('motms')}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.player_id}>
                    <Td>
                      <Link href={`/players/${r.player_id}`} style={{ textDecoration: 'underline' }}>
                        {r.player_full_name}
                      </Link>
                    </Td>
                    <Td>{r.team_name ?? ''}</Td>
                    <Td>{r.matches_played}</Td>
                    <Td>{r.runs_scored}</Td>
                    <Td>{r.wickets_taken}</Td>
                    <Td>{r.catches_taken}</Td>
                    <Td>{r.runouts_stumpings}</Td>
                    <Td>{r.motms}</Td>
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
