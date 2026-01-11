'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type MatchHdr = {
  match_id: number;
  match_date: string | null;
  venue: string | null;
  match_name: string | null;
  dated_name: string | null;
  competition: string | null;
};

type TeamRow = {
  match_id: number;
  team_id: number;
  team_name: string;
  player_id: number;
  player_name: string;
  batting_position: number | null;
  points_total: number;
  points_batting: number;
  points_bowling: number;
  points_fielding: number;
  points_misc: number;
};

type BreakdownRow = {
  match_id: number;
  team_id: number;
  player_id: number;
  stat_key: string;
  label: string;
  category: 'Batting' | 'Bowling' | 'Fielding' | 'Misc';
  points: number;
  stat_order: number;
};

const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #e5e7eb',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
};

const Th: React.FC<
  React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>
> = ({ children, style, ...rest }) => (
  <th style={{ ...thTdBase, fontWeight: 700, ...(style || {}) }} {...rest}>
    {children}
  </th>
);

const Td: React.FC<
  React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>
> = ({ children, style, ...rest }) => (
  <td style={{ ...thTdBase, ...(style || {}) }} {...rest}>
    {children}
  </td>
);

function prettyDate(d?: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MatchPointsDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = Number(params?.id);

  const [hdr, setHdr] = useState<MatchHdr | null>(null);
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [bdRows, setBdRows] = useState<BreakdownRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [teamIndex, setTeamIndex] = useState(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({}); // player_id -> open

  useEffect(() => {
    if (!matchId) return;

    (async () => {
      setErr(null);
      setLoading(true);

      // header
      const hdrRes = await supabase
        .schema('public')
        .from('v_matches_overview')
        .select('match_id, match_date, venue, match_name, dated_name, competition')
        .eq('match_id', matchId)
        .maybeSingle();

      if (hdrRes.error) {
        setErr(`Header error: ${hdrRes.error.message}`);
        setLoading(false);
        return;
      }
      setHdr(hdrRes.data as MatchHdr);

      // team rows + breakdown
      const [teamRes, bdRes] = await Promise.all([
        supabase
          .schema('public')
          .from('v_match_points_team_rows')
          .select(
            'match_id, team_id, team_name, player_id, player_name, batting_position, points_total, points_batting, points_bowling, points_fielding, points_misc'
          )
          .eq('match_id', matchId),
        supabase
          .schema('public')
          .from('v_match_points_breakdown_rows')
          .select('match_id, team_id, player_id, stat_key, label, category, points, stat_order')
          .eq('match_id', matchId),
      ]);

      if (teamRes.error || bdRes.error) {
        setErr(
          `Scorecard error: ${teamRes.error?.message ?? ''} ${bdRes.error?.message ?? ''}`.trim()
        );
        setLoading(false);
        return;
      }

      setRows((teamRes.data ?? []) as TeamRow[]);
      setBdRows((bdRes.data ?? []) as BreakdownRow[]);
      setExpanded({});
      setTeamIndex(0);
      setLoading(false);
    })();
  }, [matchId]);

  // Teams list (max 2)
  const teams = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of rows) if (!seen.has(r.team_id)) seen.set(r.team_id, r.team_name);
    return Array.from(seen.entries())
      .slice(0, 2)
      .map(([id, name]) => ({ id, name }));
  }, [rows]);

  const activeTeam = teams[teamIndex] || teams[0];

  // Players in team
  const teamPlayers = useMemo(() => {
    if (!activeTeam) return [];
    const filtered = rows.filter((r) => r.team_id === activeTeam.id);
    filtered.sort(
      (a, b) =>
        (a.batting_position ?? 99) - (b.batting_position ?? 99) ||
        a.player_name.localeCompare(b.player_name)
    );
    return filtered;
  }, [rows, activeTeam]);

  // Group breakdown per player -> per category, only non-zero points.
  const groupedBreakdown = useMemo(() => {
    const map = new Map<
      number,
      Record<'Batting' | 'Bowling' | 'Fielding' | 'Misc', { label: string; points: number; stat_order: number }[]>
    >();

    for (const r of bdRows) {
      if (r.points === 0) continue; // HIDE zero-value rows
      if (!map.has(r.player_id)) {
        map.set(r.player_id, { Batting: [], Bowling: [], Fielding: [], Misc: [] });
      }
      const bucket = map.get(r.player_id)!;
      bucket[r.category].push({ label: r.label, points: r.points, stat_order: r.stat_order });
    }

    // sort within each category
    for (const cat of map.values()) {
      (Object.keys(cat) as Array<keyof typeof cat>).forEach((k) => {
        cat[k].sort((a, b) => a.stat_order - b.stat_order || a.label.localeCompare(b.label));
      });
    }
    return map;
  }, [bdRows]);

  const cycle = () => setTeamIndex((i) => (i === 0 ? 1 : 0));
  const toggleRow = (pid: number) =>
    setExpanded((prev) => ({ ...prev, [pid]: !prev[pid] }));

  const categories: Array<'Batting' | 'Bowling' | 'Fielding' | 'Misc'> = [
    'Batting',
    'Bowling',
    'Fielding',
    'Misc',
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={() => router.back()} style={{ marginBottom: 12 }}>
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={cycle} aria-label="Previous team">◀</button>
        <h1 style={{ margin: 0 }}>
          {activeTeam ? `${activeTeam.name} Points` : loading ? 'Loading…' : 'Points'}
        </h1>
        <button onClick={cycle} aria-label="Next team">▶</button>
      </div>

      <div style={{ marginTop: 6, opacity: 0.85 }}>
        <div>{hdr?.match_name || hdr?.dated_name || ''}</div>
        <div>
          {hdr?.venue ? `${hdr.venue} • ` : ''}
          {prettyDate(hdr?.match_date)}
          {hdr?.competition ? ` • ${hdr.competition}` : ''}
        </div>
      </div>

      {err && <div style={{ color: 'crimson', marginTop: 12 }}>{err}</div>}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Players</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Player</Th>
                <Th style={{ textAlign: 'right', width: 90 }}>Total</Th>
                <Th style={{ textAlign: 'right', width: 90 }}>Batting</Th>
                <Th style={{ textAlign: 'right', width: 90 }}>Bowling</Th>
                <Th style={{ textAlign: 'right', width: 90 }}>Fielding</Th>
                <Th style={{ textAlign: 'right', width: 90 }}>Misc</Th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map((r) => {
                const isOpen = !!expanded[r.player_id];
                const bd = groupedBreakdown.get(r.player_id);
                const hasAny =
                  !!bd &&
                  (bd.Batting.length || bd.Bowling.length || bd.Fielding.length || bd.Misc.length);

                return (
                  <React.Fragment key={r.player_id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggleRow(r.player_id)}>
                      <Td>{r.player_name}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.points_total}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.points_batting}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.points_bowling}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.points_fielding}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.points_misc}</Td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <Td colSpan={6}>
                          {hasAny ? (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                gap: 16,
                                fontSize: 13,
                              }}
                            >
                              {categories.map((cat) => {
                                const items = bd ? bd[cat] : [];
                                if (!items || items.length === 0) return null; // hide empty categories
                                return (
                                  <div key={cat}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{cat}</div>
                                    <div style={{ display: 'grid', rowGap: 6 }}>
                                      {items.map((it, idx) => (
                                        <div
                                          key={`${it.label}-${idx}`}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                          }}
                                        >
                                          <span style={{ opacity: 0.9 }}>{it.label}</span>
                                          <span style={{ fontWeight: 600 }}>{it.points}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ opacity: 0.7 }}>No detailed breakdown.</div>
                          )}
                        </Td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Team total row */}
              <tr>
                <Td><strong>Team Total</strong></Td>
                <Td style={{ textAlign: 'right' }}>
                  <strong>
                    {teamPlayers.reduce((s, r) => s + (r.points_total ?? 0), 0)}
                  </strong>
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <strong>
                    {teamPlayers.reduce((s, r) => s + (r.points_batting ?? 0), 0)}
                  </strong>
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <strong>
                    {teamPlayers.reduce((s, r) => s + (r.points_bowling ?? 0), 0)}
                  </strong>
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <strong>
                    {teamPlayers.reduce((s, r) => s + (r.points_fielding ?? 0), 0)}
                  </strong>
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <strong>
                    {teamPlayers.reduce((s, r) => s + (r.points_misc ?? 0), 0)}
                  </strong>
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
