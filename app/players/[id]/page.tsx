'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

type Header = {
  player_id: number;
  player_full_name: string;
  tier: string | null;
  player_image_url: string | null; // players.image path
  date_of_birth: string | null;
  nationality: string | null;
  nationality_logo: string | null;
};

type TeamRow = {
  player_id: number;
  team_id: number;
  team_initials: string | null;
  team_logo_url: string | null; // teams.logo path
  matches_played: number;
  avg_points: number;
};

type MatchRow = {
  team_logo_url: string | null;
  team_initials: string | null;

  points_total: number;
  points_batting: number;
  points_bowling: number;
  points_fielding: number;
  points_misc: number;

  match_id: number;
  match_date: string;
  format: string | null;
  venue: string | null;
  competition_id: number | null;
  competition: string | null;
  match_name: string | null;
  dated_name: string | null;

  player_id: number;
  player_full_name: string | null;
  player_name: string | null;
  active: boolean | null;

  team_id: number | null;
  team_name: string | null;
  innings_group: number | null;

  runs_scored: number | null;
  balls_faced: number | null;
  fours: number | null;
  sixes: number | null;
  strike_rate: string | null;

  out_flag: boolean | null;
  dnb: boolean | null;

  balls_bowled: number | null;
  maidens_bowled: number | null;
  runs_conceded: number | null;
  wickets_taken: number | null;
  economy_rate: string | null;

  no_balls_bowled: number | null;
  dots_bowled: number | null;

  catches_taken: number | null;
  stumpings: number | null;
  run_outs: number | null;
  runouts_stumpings: number | null;

  is_man_of_the_match: boolean | null;
};

const S_HEADER = 'v_player_profile_header';
const S_TEAMS = 'v_player_profile_teams_rollup';
const S_ROWS = 'v_player_profile_match_rows';
const S_MY_CARDS = 'v_my_player_cards';

const ASSET_BASE = 'https://fantasy-cricket-assets.vercel.app';

/* ---------- styles ---------- */
const pageWrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '24px 16px' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1.2fr', gap: 16, alignItems: 'start' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16 };
const heroArea: React.CSSProperties = { marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 };
const badge: React.CSSProperties = { fontSize: 12, fontWeight: 700, background: '#111', color: '#fff', padding: '4px 8px', borderRadius: 999 };
const heroImgWrap: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'center' };
const heroImg: React.CSSProperties = { width: 420, height: 280, objectFit: 'cover', borderRadius: 14, border: '1px solid #ddd' };
const title: React.CSSProperties = { fontSize: 26, fontWeight: 800, marginTop: 10, textAlign: 'center' };
const subline: React.CSSProperties = { fontSize: 13, opacity: 0.8, textAlign: 'center', marginTop: 4 };

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 8 };
const thtd: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 10px', textAlign: 'left', verticalAlign: 'top', fontSize: 14 };
const theadStyle: React.CSSProperties = { background: '#fafafa' };
const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginBottom: 8 };

const controlsRow: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 8, alignItems: 'center' };
const pill: React.CSSProperties = { display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 999, background: '#f9f9f9' };

const toggleWrap: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10 };
const toggleTrack: React.CSSProperties = { width: 42, height: 24, borderRadius: 999, border: '1px solid #ccc', position: 'relative', cursor: 'pointer' };
const toggleKnob: React.CSSProperties = { width: 18, height: 18, borderRadius: 999, background: '#fff', border: '1px solid #ccc', position: 'absolute', top: 2, transition: 'left 150ms ease' };

/* ---------- helpers ---------- */
function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return digits ? Number(n).toFixed(digits) : String(n);
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}
function within6Months(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const sixAgo = new Date();
  sixAgo.setMonth(now.getMonth() - 6);
  return dt >= sixAgo;
}
function assetUrl(pathOnly: string | null | undefined, fallback: string) {
  if (!pathOnly) return fallback;
  if (pathOnly.startsWith('http://') || pathOnly.startsWith('https://')) return pathOnly;
  return `${ASSET_BASE}/${pathOnly}`;
}
function safeLabel(s: string, max = 80) {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playerId = Number(params?.id);

  const [header, setHeader] = useState<Header | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  type Period = 'all' | '6m' | 'last';
  const [period, setPeriod] = useState<Period>('all');
  const [showAvg, setShowAvg] = useState(false);

  const [ownedCount, setOwnedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const [h, t, r] = await Promise.all([
          supabase.from(S_HEADER).select('*').eq('player_id', playerId).single<Header>(),
          supabase.from(S_TEAMS).select('*').eq('player_id', playerId) as any,
          supabase.from(S_ROWS).select('*').eq('player_id', playerId).order('match_date', { ascending: false }) as any,
        ]);

        if (h.error) throw h.error;
        if (cancelled) return;

        setHeader(h.data as Header);
        setTeams((t.data ?? []) as TeamRow[]);
        setRows((r.data ?? []) as MatchRow[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadOwnership() {
      try {
        setOwnedCount(null);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setOwnedCount(0);
          return;
        }

        const q = await supabase
          .from(S_MY_CARDS)
          .select('ownership_id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('player_id', playerId)
          .eq('is_current', true);

        if (q.error) throw q.error;
        setOwnedCount(q.count ?? 0);
      } catch {
        setOwnedCount(0);
      }
    }

    if (Number.isFinite(playerId)) {
      load();
      loadOwnership();
    }

    return () => { cancelled = true; };
  }, [playerId]);

  const periodRows = useMemo(() => {
    if (rows.length === 0) return [];
    if (period === 'all') return rows;
    if (period === '6m') return rows.filter(r => within6Months(r.match_date));
    return rows.slice(0, 1);
  }, [rows, period]);

  const derived = useMemo(() => {
    const mp = periodRows.length;
    const sum = (getter: (r: MatchRow) => number | null) =>
      periodRows.reduce((acc, r) => acc + (getter(r) ?? 0), 0);

    const totalPoints = sum(r => r.points_total);
    const batPts = sum(r => r.points_batting);
    const bowlPts = sum(r => r.points_bowling);
    const fldPts = sum(r => r.points_fielding);
    const miscPts = sum(r => r.points_misc);

    const totalRuns = sum(r => toNum(r.runs_scored));
    const totalBalls = sum(r => toNum(r.balls_faced));
    const total4s = sum(r => toNum(r.fours));
    const total6s = sum(r => toNum(r.sixes));

    const totalWkts = sum(r => toNum(r.wickets_taken));
    const totalRunsConceded = sum(r => toNum(r.runs_conceded));
    const totalBallsBowled = sum(r => toNum(r.balls_bowled));

    const cnt25 = periodRows.reduce((a, r) => a + ((toNum(r.runs_scored) ?? 0) >= 25 ? 1 : 0), 0);
    const cnt30 = periodRows.reduce((a, r) => a + ((toNum(r.runs_scored) ?? 0) >= 30 ? 1 : 0), 0);
    const cnt50 = periodRows.reduce((a, r) => a + ((toNum(r.runs_scored) ?? 0) >= 50 ? 1 : 0), 0);
    const cnt100 = periodRows.reduce((a, r) => a + ((toNum(r.runs_scored) ?? 0) >= 100 ? 1 : 0), 0);

    const sr = totalBalls > 0 ? (totalRuns / totalBalls) * 100 : null;
    const overs = totalBallsBowled > 0 ? (totalBallsBowled / 6) : null;
    const er = overs && overs > 0 ? (totalRunsConceded / overs) : null;

    const div = (v: number, by: number) => (by > 0 ? v / by : 0);

    return {
      matches: mp,
      totalPoints, batPts, bowlPts, fldPts, miscPts,
      totalRuns, total4s, total6s, sr, er, totalWkts, totalRunsConceded,
      cnt25, cnt30, cnt50, cnt100,
      avgPoints: mp > 0 ? div(totalPoints, mp) : null,
      avgBatPts: mp > 0 ? div(batPts, mp) : null,
      avgBowlPts: mp > 0 ? div(bowlPts, mp) : null,
      avgFldPts: mp > 0 ? div(fldPts, mp) : null,
      avgMiscPts: mp > 0 ? div(miscPts, mp) : null,
      avgRuns: mp > 0 ? div(totalRuns, mp) : null,
      avg4s: mp > 0 ? div(total4s, mp) : null,
      avg6s: mp > 0 ? div(total6s, mp) : null,
      avgWkts: mp > 0 ? div(totalWkts, mp) : null,
      avgRunsConceded: mp > 0 ? div(totalRunsConceded, mp) : null,
    };
  }, [periodRows]);

  // Group match rows by match_id, SUM points, keep names, sort by date
  const groupedMatches = useMemo(() => {
    if (rows.length === 0) return [];

    const map = new Map<number, {
      match_id: number;
      match_date: string;
      match_name: string | null;
      dated_name: string | null;
      competition: string | null;
      format: string | null;
      result_text: string | null; // not present in match_rows; kept as null
      points_total: number;
    }>();

    for (const r of rows) {
      const cur = map.get(r.match_id);
      if (!cur) {
        map.set(r.match_id, {
          match_id: r.match_id,
          match_date: r.match_date,
          match_name: r.match_name ?? null,
          dated_name: r.dated_name ?? null,
          competition: r.competition ?? null,
          format: r.format ?? null,
          result_text: null,
          points_total: r.points_total ?? 0,
        });
      } else {
        cur.points_total += (r.points_total ?? 0);

        if (!cur.match_name && r.match_name) cur.match_name = r.match_name;
        if (!cur.dated_name && r.dated_name) cur.dated_name = r.dated_name;
        if (!cur.competition && r.competition) cur.competition = r.competition;
        if (!cur.format && r.format) cur.format = r.format;

        if (r.match_date && new Date(r.match_date) > new Date(cur.match_date)) cur.match_date = r.match_date;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      return new Date(b.match_date).getTime() - new Date(a.match_date).getTime(); // newest first
    });
  }, [rows]);

  // Chart data = last 10 (chronological) from grouped matches, axis labels M1..M10
  const chartData = useMemo(() => {
    const last10Desc = groupedMatches.slice(0, 10);
    const chrono = [...last10Desc].reverse();
    return chrono.map((m, idx) => {
      const full = m.match_name ?? m.dated_name ?? `Match #${m.match_id}`;
      return {
        match_id: m.match_id,
        label: `M${idx + 1}`,
        full_name: full,
        points: m.points_total,
      };
    });
  }, [groupedMatches]);

  if (!Number.isFinite(playerId)) return <div style={pageWrap}>Invalid player id.</div>;

  const playerImgSrc = assetUrl(header?.player_image_url, '/default_player.png');

  return (
    <div style={pageWrap}>
      {/* Hero */}
      <div style={card}>
        <div style={{ ...heroArea, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {header?.tier ? <span style={badge}>{header.tier}</span> : <span style={badge}>Tier —</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {header?.nationality_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assetUrl(header.nationality_logo, header.nationality_logo)}
                  alt="flag"
                  width={28}
                  height={28}
                  style={{ borderRadius: 6, border: '1px solid #ddd' }}
                />
              ) : null}
              <div style={{ fontSize: 13, opacity: 0.8 }}>{header?.nationality ?? '—'}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>
            {ownedCount === null ? '—' : ownedCount > 0 ? `You Own ${ownedCount}` : 'Not Owned'}
          </div>
        </div>

        <div style={heroImgWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={playerImgSrc} alt={header?.player_full_name || 'Player'} style={heroImg} />
        </div>

        <div style={title}>{header?.player_full_name ?? 'Player'}</div>
        <div style={subline}>
          {header?.date_of_birth ? `DOB: ${new Date(header.date_of_birth).toLocaleDateString()}` : 'DOB: —'}
        </div>
      </div>

      {/* Body */}
      <div style={grid3}>
        {/* Teams */}
        <div style={{ ...card, background: '#f5fff1' }}>
          <div style={sectionTitle}>Teams</div>
          <table style={table}>
            <thead style={theadStyle}>
              <tr>
                <th style={thtd}>Team</th>
                <th style={thtd}>Mat</th>
                <th style={thtd}>Avg Pts</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const teamImgSrc = assetUrl(t.team_logo_url, '/logo.png');
                return (
                  <tr key={`${t.player_id}-${t.team_id}`}>
                    <td style={thtd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={teamImgSrc} alt={t.team_initials ?? 'Team'} width={20} height={20} style={{ borderRadius: 4, border: '1px solid #ddd' }} />
                        <span>{t.team_initials ?? '—'}</span>
                      </div>
                    </td>
                    <td style={thtd}>{t.matches_played}</td>
                    <td style={thtd}>{fmt(t.avg_points)}</td>
                  </tr>
                );
              })}
              {teams.length === 0 && <tr><td style={thtd} colSpan={3}>&mdash; No teams found &mdash;</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div style={{ ...card, background: '#fffbe8' }}>
          <div style={sectionTitle}>Stats</div>

          <div style={controlsRow}>
            <div style={pill}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="period" checked={period === 'all'} onChange={() => setPeriod('all')} />
                All-time
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="period" checked={period === '6m'} onChange={() => setPeriod('6m')} />
                Last 6 months
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="period" checked={period === 'last'} onChange={() => setPeriod('last')} />
                Last match
              </label>
            </div>

            <div style={pill}>
              <div style={toggleWrap}>
                <div
                  role="switch"
                  aria-checked={showAvg}
                  tabIndex={0}
                  onClick={() => setShowAvg(v => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowAvg(v => !v); }}
                  style={{ ...toggleTrack, background: showAvg ? '#111' : '#f1f1f1', borderColor: showAvg ? '#111' : '#ccc' }}
                >
                  <div style={{ ...toggleKnob, left: showAvg ? 21 : 3, background: '#fff', borderColor: showAvg ? '#111' : '#ccc' }} />
                </div>
                <span>Show match average data</span>
              </div>
            </div>
          </div>

          <table style={table}>
            <tbody>
              <tr><td style={thtd}><strong>Matches</strong></td><td style={thtd}>{derived.matches}</td></tr>

              <tr><td style={thtd}><strong>{showAvg ? 'Avg. Points' : 'Total Points'}</strong></td><td style={thtd}>{showAvg ? fmt(derived.avgPoints, 2) : fmt(derived.totalPoints)}</td></tr>
              <tr><td style={thtd}>Batting {showAvg ? '(avg)' : '(total)'}</td><td style={thtd}>{showAvg ? fmt(derived.avgBatPts, 2) : fmt(derived.batPts)}</td></tr>
              <tr><td style={thtd}>Bowling {showAvg ? '(avg)' : '(total)'}</td><td style={thtd}>{showAvg ? fmt(derived.avgBowlPts, 2) : fmt(derived.bowlPts)}</td></tr>
              <tr><td style={thtd}>Fielding {showAvg ? '(avg)' : '(total)'}</td><td style={thtd}>{showAvg ? fmt(derived.avgFldPts, 2) : fmt(derived.fldPts)}</td></tr>
              <tr><td style={thtd}>Misc {showAvg ? '(avg)' : '(total)'}</td><td style={thtd}>{showAvg ? fmt(derived.avgMiscPts, 2) : fmt(derived.miscPts)}</td></tr>

              <tr><td style={thtd}><strong>{showAvg ? 'Avg. Runs' : 'Total Runs'}</strong></td><td style={thtd}>{showAvg ? fmt(derived.avgRuns, 2) : fmt(derived.totalRuns)}</td></tr>
              <tr><td style={thtd}>{showAvg ? 'Avg. 4s' : 'Total 4s'}</td><td style={thtd}>{showAvg ? fmt(derived.avg4s, 2) : fmt(derived.total4s)}</td></tr>
              <tr><td style={thtd}>{showAvg ? 'Avg. 6s' : 'Total 6s'}</td><td style={thtd}>{showAvg ? fmt(derived.avg6s, 2) : fmt(derived.total6s)}</td></tr>

              <tr><td style={thtd}>25+ / 30+ / 50+ / 100+</td><td style={thtd}>{derived.cnt25} / {derived.cnt30} / {derived.cnt50} / {derived.cnt100}</td></tr>

              <tr><td style={thtd}>{showAvg ? 'Avg. SR' : 'SR'}</td><td style={thtd}>{fmt(derived.sr, 2)}</td></tr>
              <tr><td style={thtd}>{showAvg ? 'Avg. ER' : 'ER'}</td><td style={thtd}>{fmt(derived.er, 2)}</td></tr>

              <tr><td style={thtd}><strong>{showAvg ? 'Avg. Wkts' : 'Total Wkts'}</strong></td><td style={thtd}>{showAvg ? fmt(derived.avgWkts, 2) : fmt(derived.totalWkts)}</td></tr>
              <tr><td style={thtd}>{showAvg ? 'Avg. Runs Conceded' : 'Total Runs Conceded'}</td><td style={thtd}>{showAvg ? fmt(derived.avgRunsConceded, 2) : fmt(derived.totalRunsConceded)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Last 10 Matches */}
        <div style={{ ...card, background: '#e9fbf4' }}>
          <div style={sectionTitle}>Last 10 Matches</div>

          <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => [value, 'Points']}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as any;
                    return safeLabel(p?.full_name ?? 'Match', 80);
                  }}
                />
                <Legend />
                <Bar dataKey="points" name="Points" fill="#2563eb">
                  {chartData.map((entry: any) => (
                    <Cell
                      key={entry.match_id}
                      cursor="pointer"
                      onClick={() => router.push(`/matches/points/${entry.match_id}`)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table style={table}>
            <thead style={theadStyle}>
              <tr>
                <th style={thtd}>Date</th>
                <th style={thtd}>Match</th>
                <th style={thtd}>Competition</th>
                <th style={thtd}>Format</th>
                <th style={thtd}>Result</th>
                <th style={thtd}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {groupedMatches.slice(0, 10).map((m) => {
                const matchText = m.match_name ?? m.dated_name ?? `Match #${m.match_id}`;
                return (
                  <tr key={m.match_id}>
                    <td style={thtd}>{new Date(m.match_date).toLocaleDateString()}</td>
                    <td style={thtd}>
                      <Link href={`/matches/${m.match_id}`} style={{ textDecoration: 'underline' }}>
                        {matchText}
                      </Link>
                    </td>
                    <td style={thtd}>{m.competition ?? '-'}</td>
                    <td style={thtd}>{m.format ?? '-'}</td>
                    <td style={thtd}>{m.result_text ?? '-'}</td>
                    <td style={thtd}>{m.points_total}</td>
                  </tr>
                );
              })}
              {groupedMatches.length === 0 && (
                <tr><td style={thtd} colSpan={6}>&mdash; No recent matches &mdash;</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <div style={{ marginTop: 12, opacity: 0.7 }}>Loading…</div>}
      {err && <div style={{ marginTop: 12, color: 'crimson' }}>{err}</div>}
    </div>
  );
}
