'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

/** ---- types that match your PUBLIC views ---- */
type MatchHdr = {
  match_id: number;
  match_date: string | null;
  venue: string | null;
  match_name: string | null;
  dated_name: string | null;
  competition: string | null;
  result: string | null;           // winning team name (e.g., "India", "Tie", "NR")
  detailed_result: string | null;  // e.g. "Won by 5 wickets with 2 balls to spare"
  // optional fields if present in v_matches_overview (we'll guard their usage)
  home_team?: string | null;
  away_team?: string | null;
  home_score?: string | null;      // e.g. "150/5 in 19.4"
  away_score?: string | null;      // e.g. "149/9 in 20.0"
};

type BatRow = {
  match_id: number;
  team_id: number | null;
  team_name: string | null;
  batting_position: number | null;
  batter_name: string | null;      // NOTE: matches your view
  dismissal_text: string | null;
  runs: number | null;             // NOTE: runs column name in your view
  balls: number | null;            // NOTE: balls column name in your view
  fours: number | null;
  sixes: number | null;
  strike_rate: number | null;
  not_out: boolean | null;         // NOTE: not_out column name in your view
};

type BowlRow = {
  match_id: number;
  team_id: number | null;          // bowling team id in your view
  team_name: string | null;        // bowling team name in your view
  bowler_name: string | null;      // NOTE: matches your view
  overs_text: string | null;        // NOTE: text overs column in your view
  maidens: number | null;
  runs_conceded: number | null;
  wickets: number | null;
  economy_rate: number | null;
  no_balls: number | null;
};

type MetaRow = {
  match_id: number;
  team_batting_first: number | null;
  team_batting_second: number | null;
  batting_first_team: string | null;
  batting_second_team: string | null;
};

/* ---- small presentational helpers ---- */
const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
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

export default function MatchDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = Number(params?.id);

  const [hdr, setHdr] = useState<MatchHdr | null>(null);
  const [bat, setBat] = useState<BatRow[]>([]);
  const [bowl, setBowl] = useState<BowlRow[]>([]);
  const [meta, setMeta] = useState<MetaRow | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [teamIndex, setTeamIndex] = useState(0); // 0 = first team, 1 = second team
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!matchId) return;

    (async () => {
      setErr(null);
      setLoading(true);

      // 1) Header (+ total score strings if available)
      const hdrRes = await supabase
        .schema('public')
        .from('v_matches_overview')
        .select(
          'match_id, match_date, venue, match_name, dated_name, competition, result, detailed_result, home_team, away_team, home_score, away_score'
        )
        .eq('match_id', matchId)
        .maybeSingle();

      if (hdrRes.error) {
        setErr(`Header error: ${hdrRes.error.message}`);
        setLoading(false);
        return;
      }
      setHdr(hdrRes.data as MatchHdr);

      // 2) Scorecards
      const [batRes, bowlRes] = await Promise.all([
        supabase
          .schema('public')
          .from('v_match_batting_scorecard')
          .select(
            'match_id, team_id, team_name, batting_position, batter_name, dismissal_text, runs, balls, fours, sixes, strike_rate, not_out'
          )
          .eq('match_id', matchId),
        supabase
          .schema('public')
          .from('v_match_bowling_scorecard')
          .select(
            'match_id, team_id, team_name, bowler_name, overs_text, maidens, runs_conceded, wickets, economy_rate, no_balls'
          )
          .eq('match_id', matchId),
      ]);

      if (batRes.error || bowlRes.error) {
        setErr(
          `Scorecard error: ${batRes.error?.message ?? ''} ${bowlRes.error?.message ?? ''}`.trim()
        );
        setLoading(false);
        return;
      }

      setBat(batRes.data ?? []);
      setBowl(bowlRes.data ?? []);

      // 3) Meta for team ordering fallback
      const metaRes = await supabase
        .schema('public')
        .from('v_match_meta')
        .select('match_id, team_batting_first, team_batting_second, batting_first_team, batting_second_team')
        .eq('match_id', matchId)
        .maybeSingle();

      if (!metaRes.error && metaRes.data) setMeta(metaRes.data as MetaRow);

      setExpanded({});
      setTeamIndex(0);
      setLoading(false);
    })();
  }, [matchId]);

  /* ---- derive the 2 teams ---- */
  const teams = useMemo(() => {
    // First try from batting rows: keep order by batting_position ascending within each team,
    // but to decide 1st/2nd innings we’ll use frequency order as a rough proxy
    const seen = new Map<number, string>();
    for (const r of bat) {
      if (r.team_id != null && r.team_name && !seen.has(r.team_id)) {
        seen.set(r.team_id, r.team_name);
      }
    }
    const arr = Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    if (arr.length === 2) return arr;

    // Fallback to meta
    if (meta?.team_batting_first && meta?.team_batting_second) {
      return [
        { id: meta.team_batting_first, name: meta.batting_first_team ?? `Team ${meta.team_batting_first}` },
        { id: meta.team_batting_second, name: meta.batting_second_team ?? `Team ${meta.team_batting_second}` },
      ];
    }
    return arr;
  }, [bat, meta]);

  const activeTeam = teams[teamIndex] || teams[0];

  const activeBat = useMemo(() => {
    if (!activeTeam) return [];
    const rows = bat.filter((r) => r.team_id === activeTeam.id);
    rows.sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99));
    return rows;
  }, [bat, activeTeam]);

  const otherTeamId = useMemo(
    () => teams.find((t) => t.id !== activeTeam?.id)?.id,
    [teams, activeTeam]
  );

  const activeBowl = useMemo(() => {
    if (!otherTeamId) return [];
    return bowl.filter((r) => r.team_id === otherTeamId);
  }, [bowl, otherTeamId]);

  /* ---- result line and team total helpers ---- */
  const resultLine = useMemo(() => {
    if (!hdr) return '';
    // “India won by …” or just detailed_result if result missing
    const base = hdr.result ? `${hdr.result} ${hdr.detailed_result ?? ''}`.trim() : (hdr.detailed_result ?? '');
    return base;
  }, [hdr]);

  function teamTotalForActive(): string {
    if (!hdr || !activeTeam) return '-';
    // Prefer v_matches_overview totals if team name matches
    const name = activeTeam.name?.toLowerCase() ?? '';
    const home = hdr.home_team?.toLowerCase() ?? '';
    const away = hdr.away_team?.toLowerCase() ?? '';

    if (name && home && name === home && hdr.home_score) return hdr.home_score;
    if (name && away && name === away && hdr.away_score) return hdr.away_score;

    // Fallback: build from best we have on the batting rows (runs/wkts not all available as one string)
    // We don’t have wickets column per-row total, so show what we do have if scoreline isn’t available.
    // (Your overview covers the canonical string anyway.)
    const runsSum = activeBat.reduce((s, r) => s + (r.runs ?? 0), 0);
    return `${runsSum} (total)`;
  }

  const cycleLeft  = () => setTeamIndex((i) => (i === 0 ? 1 : 0));
  const cycleRight = () => setTeamIndex((i) => (i === 0 ? 1 : 0));

  const toggleRow = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const noScorecard = !loading && (bat.length === 0 || teams.length === 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={() => router.back()} style={{ marginBottom: 12 }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={cycleLeft} aria-label="Previous innings">{'<'}</button>
        <h1 style={{ margin: 0 }}>
          {activeTeam ? `${activeTeam.name} Innings` : loading ? 'Loading…' : 'No scorecard'}
        </h1>
        <button onClick={cycleRight} aria-label="Next innings">{'>'}</button>
      </div>

      <div style={{ marginTop: 6, opacity: 0.85 }}>
        <div>{hdr?.match_name || hdr?.dated_name || ''}</div>
        <div>
          {hdr?.venue ? `${hdr.venue} • ` : ''}
          {prettyDate(hdr?.match_date)}
          {hdr?.competition ? ` • ${hdr.competition}` : ''}
        </div>
        {!!resultLine && (
          <div style={{ marginTop: 6 }}>{resultLine}</div>
        )}
      </div>

      {err && (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          {err}
        </div>
      )}

      {noScorecard && (
        <div style={{ marginTop: 16, opacity: 0.8 }}>
          No scorecard data is available for this match yet.
        </div>
      )}

      {/* Batting */}
      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Batting</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th style={{ width: '45%' }}>Batter</Th>
                <Th style={{ width: '35%' }}>Dismissal</Th>
                <Th style={{ width: 80, textAlign: 'right' }}>R</Th>
                <Th style={{ width: 80, textAlign: 'right' }}>B</Th>
              </tr>
            </thead>
            <tbody>
              {activeBat.map((r, idx) => {
                const key = `${r.batter_name}-${idx}`;
                const isNotOut = !!r.not_out;
                return (
                  <React.Fragment key={key}>
                    <tr
                      style={{
                        background: isNotOut ? '#f7fff7' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleRow(key)}
                    >
                      <Td>{r.batter_name ?? ''}</Td>
                      <Td>{r.dismissal_text ?? (isNotOut ? 'not out' : '')}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.runs ?? ''}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.balls ?? ''}</Td>
                    </tr>
                    {expanded[key] && (
                      <tr>
                        <Td colSpan={4}>
                          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                            <div>4s: <strong>{r.fours ?? 0}</strong></div>
                            <div>6s: <strong>{r.sixes ?? 0}</strong></div>
                            <div>SR: <strong>{r.strike_rate ?? '-'}</strong></div>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Team Total row */}
              <tr>
                <Td colSpan={4} style={{ background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Team Total</strong></span>
                    <span><strong>{teamTotalForActive()}</strong></span>
                  </div>
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Bowling */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 8 }}>Bowling</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th style={{ width: '40%' }}>Bowler</Th>
                <Th style={{ width: 90, textAlign: 'right' }}>O</Th>
                <Th style={{ width: 90, textAlign: 'right' }}>M</Th>
                <Th style={{ width: 90, textAlign: 'right' }}>R</Th>
                <Th style={{ width: 90, textAlign: 'right' }}>W</Th>
                <Th style={{ width: 110, textAlign: 'right' }}>ER</Th>
              </tr>
            </thead>
            <tbody>
              {activeBowl.map((r, idx) => {
                const key = `bowl-${r.bowler_name}-${idx}`;
                return (
                  <React.Fragment key={key}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggleRow(key)}>
                      <Td>{r.bowler_name ?? ''}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.overs_text ?? ''}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.maidens ?? 0}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.runs_conceded ?? 0}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.wickets ?? 0}</Td>
                      <Td style={{ textAlign: 'right' }}>{r.economy_rate ?? '-'}</Td>
                    </tr>
                    {expanded[key] && (
                      <tr>
                        <Td colSpan={6}>
                          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                            <div>NB: <strong>{r.no_balls ?? 0}</strong></div>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
