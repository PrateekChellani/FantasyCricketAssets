'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type PlayerRow = {
  player_id: number;
  full_name: string;
};

type TeamRow = {
  team_id: number;
  team_name: string;
  short_name: string | null;
  logo: string | null;
};

type MatchOverviewRow = {
  match_id: number;
  competition: string | null;
  format: string | null;
  match_name: string | null;
  dated_name: string | null;
  venue: string | null;
  match_date: string | null;

  home_team: string | null;
  away_team: string | null;
};

type WinnerChoice = 'HOME' | 'AWAY' | 'TIE' | 'NR' | '';

type DismissalMethod =
  | ''
  | 'Bowled'
  | 'Caught'
  | 'LBW (Leg Before Wicket)'
  | 'Run-out'
  | 'Stumped'
  | 'Not Out'
  | 'Other';

type BatRow = {
  player_name: string;
  dnb: boolean;
  method: DismissalMethod;
  dis1: string; // bowler / fielder
  dis2: string; // catcher/stumper
  runs: string;
  balls: string;
  minutes: string; // nullable
  fours: string;
  sixes: string;
};

type BowlRow = {
  player_name: string;
  balls: string;
  maidens: string;
  runs_conceded: string;
  wickets: string;
  dots: string;
  wides: string;
  no_balls: string;
};

const ASSETS_BASE = 'https://fantasy-cricket-assets.vercel.app/';

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
  <th style={{ ...thTdBase, fontWeight: 800, ...(style || {}) }} {...rest}>
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

function isEmpty(v: string | null | undefined) {
  return (v ?? '').trim() === '';
}

function makeBatRows(n: number): BatRow[] {
  return Array.from({ length: n }).map(() => ({
    player_name: '',
    dnb: false,
    method: '',
    dis1: '',
    dis2: '',
    runs: '',
    balls: '',
    minutes: '',
    fours: '',
    sixes: '',
  }));
}

function makeBowlRows(n: number): BowlRow[] {
  return Array.from({ length: n }).map(() => ({
    player_name: '',
    balls: '',
    maidens: '',
    runs_conceded: '',
    wickets: '',
    dots: '',
    wides: '',
    no_balls: '',
  }));
}

function toIntOrNull(v: string) {
  const t = (v ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function Unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toastBoxStyle(kind: 'ok' | 'err'): React.CSSProperties {
  return {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 100,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: '#fff',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    fontWeight: 800,
    color: kind === 'ok' ? '#0a7a35' : 'crimson',
    maxWidth: 520,
    whiteSpace: 'pre-wrap',
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  border: '1px solid #ddd',
  borderRadius: 8,
};

const smallInputStyle: React.CSSProperties = {
  padding: 8,
  border: '1px solid #ddd',
  borderRadius: 8,
};

const sectionCard: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 14,
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 6,
};

function PlayerTypeahead({
  value,
  onChange,
  players,
  listId,
  placeholder,
  minWidth = 220,
}: {
  value: string;
  onChange: (v: string) => void;
  players: string[];
  listId: string;
  placeholder?: string;
  minWidth?: number;
}) {
  return (
    <div>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, minWidth }}
        placeholder={placeholder ?? 'Type player…'}
      />
      <datalist id={listId}>
        {players.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

// Dismissal detail rules (caught/stumped ordering already correct)
function DismissalDetail({
  method,
  dis1,
  dis2,
  setDis1,
  setDis2,
  players,
  listIdPrefix,
}: {
  method: DismissalMethod;
  dis1: string;
  dis2: string;
  setDis1: (v: string) => void;
  setDis2: (v: string) => void;
  players: string[];
  listIdPrefix: string;
}) {
  if (method === 'Bowled' || method === 'LBW (Leg Before Wicket)') {
    return <PlayerTypeahead value={dis1} onChange={setDis1} players={players} listId={`${listIdPrefix}-one`} />;
  }

  if (method === 'Run-out') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <PlayerTypeahead value={dis1} onChange={setDis1} players={players} listId={`${listIdPrefix}-ro1`} />
        <PlayerTypeahead value={dis2} onChange={setDis2} players={players} listId={`${listIdPrefix}-ro2`} />
      </div>
    );
  }

  // Caught: c first, then b (dis2=c, dis1=b)
  if (method === 'Caught') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>c</div>
        <PlayerTypeahead value={dis2} onChange={setDis2} players={players} listId={`${listIdPrefix}-c`} />
        <div style={{ fontWeight: 800 }}>b</div>
        <PlayerTypeahead value={dis1} onChange={setDis1} players={players} listId={`${listIdPrefix}-b`} />
      </div>
    );
  }

  // Stumped: st first, then b (dis2=st, dis1=b)
  if (method === 'Stumped') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>st</div>
        <PlayerTypeahead value={dis2} onChange={setDis2} players={players} listId={`${listIdPrefix}-st`} />
        <div style={{ fontWeight: 800 }}>b</div>
        <PlayerTypeahead value={dis1} onChange={setDis1} players={players} listId={`${listIdPrefix}-b2`} />
      </div>
    );
  }

  return <div style={{ opacity: 0.5 }} />;
}

function getUniqueEnteredPlayers(firstBat: BatRow[], secondBat: BatRow[], firstBowl: BowlRow[], secondBowl: BowlRow[]) {
  const names = [
    ...firstBat.map((r) => r.player_name),
    ...secondBat.map((r) => r.player_name),
    ...firstBowl.map((r) => r.player_name),
    ...secondBowl.map((r) => r.player_name),
    ...firstBat.flatMap((r) => [r.dis1, r.dis2]),
    ...secondBat.flatMap((r) => [r.dis1, r.dis2]),
  ]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0);

  return Unique(names);
}

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', border: '1px solid #eee' }}
    />
  );
}

function ScoreLine({
  teamName,
  teamLogoUrl,
  score,
  wickets,
  overs,
  setScore,
  setWickets,
  setOvers,
}: {
  teamName: string;
  teamLogoUrl: string | null;
  score: string;
  wickets: string;
  overs: string;
  setScore: (v: string) => void;
  setWickets: (v: string) => void;
  setOvers: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid #eee',
      }}
    >
      <div style={{ flex: 1, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
        <TeamLogo src={teamLogoUrl} alt={teamName} />
        <span>{teamName}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          placeholder="Score"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          style={{ ...smallInputStyle, width: 110 }}
        />
        <input
          placeholder="Wickets"
          value={wickets}
          onChange={(e) => setWickets(e.target.value)}
          style={{ ...smallInputStyle, width: 110 }}
        />
        <input
          placeholder="Overs"
          value={overs}
          onChange={(e) => setOvers(e.target.value)}
          style={{ ...smallInputStyle, width: 110 }}
        />
      </div>
    </div>
  );
}

/**
 * Hard timeout wrapper so "hung" PostgREST requests surface visibly.
 * Note: this rejects locally; it does not cancel the underlying network request.
 */
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms (${label})`)), ms);

    Promise.resolve(p)
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

function safeStringifyError(e: any) {
  try {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    const out: any = {
      message: e?.message,
      name: e?.name,
      status: e?.status,
      statusCode: e?.statusCode,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
    };
    return JSON.stringify(out, null, 2);
  } catch {
    return String(e?.message ?? e ?? 'Unknown error');
  }
}

export default function AddMatchDetailPage() {
  const params = useParams();
  const matchId = Number(params?.id);

  const [match, setMatch] = useState<MatchOverviewRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // NEW: submitting state + recover in finally
  const [submitting, setSubmitting] = useState(false);

  // top inputs
  const [homeScore, setHomeScore] = useState('');
  const [homeWkts, setHomeWkts] = useState('');
  const [homeOvers, setHomeOvers] = useState('');

  const [awayScore, setAwayScore] = useState('');
  const [awayWkts, setAwayWkts] = useState('');
  const [awayOvers, setAwayOvers] = useState('');

  const [winner, setWinner] = useState<WinnerChoice>('');
  const [tossWinner, setTossWinner] = useState(''); // nullable dropdown
  const [battingFirst, setBattingFirst] = useState(''); // nullable dropdown

  // innings tables
  const [firstBat, setFirstBat] = useState<BatRow[]>(() => makeBatRows(11));
  const [secondBat, setSecondBat] = useState<BatRow[]>(() => makeBatRows(11));

  const [firstBowl, setFirstBowl] = useState<BowlRow[]>(() => makeBowlRows(5));
  const [secondBowl, setSecondBowl] = useState<BowlRow[]>(() => makeBowlRows(5));

  const [firstBatCaptainIdx, setFirstBatCaptainIdx] = useState<number | null>(null);
  const [firstBatKeeperIdx, setFirstBatKeeperIdx] = useState<number | null>(null);

  const [secondBatCaptainIdx, setSecondBatCaptainIdx] = useState<number | null>(null);
  const [secondBatKeeperIdx, setSecondBatKeeperIdx] = useState<number | null>(null);

  const [playerOfMatch, setPlayerOfMatch] = useState('');

  // Debug helper: prefix all logs for this page
  const dbg = (...args: any[]) => console.log('[add_match/[id]]', ...args);

  useEffect(() => {
    dbg('Mounted. matchId param =', params?.id, 'parsed matchId =', matchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!matchId || Number.isNaN(matchId)) return;

    (async () => {
      setErr(null);

      dbg('Loading match/players/teams…');

      const { data: mData, error: mErr } = await supabase
        .schema('public')
        .from('v_matches_overview')
        .select('match_id, competition, format, match_name, dated_name, venue, match_date, home_team, away_team')
        .eq('match_id', matchId)
        .maybeSingle();

      if (mErr) {
        setErr(mErr.message);
        setMatch(null);
        dbg('Load match FAILED:', mErr);
        return;
      }
      setMatch((mData ?? null) as MatchOverviewRow);
      dbg('Match loaded:', mData);

      const { data: pData, error: pErr } = await supabase
        .schema('public')
        .from('players')
        .select('player_id, full_name')
        .order('full_name', { ascending: true });

      if (pErr) {
        setErr((prev) => (prev ? `${prev} | ${pErr.message}` : pErr.message));
        setPlayers([]);
        dbg('Load players FAILED:', pErr);
        return;
      }
      setPlayers((pData ?? []) as PlayerRow[]);
      dbg('Players loaded:', (pData ?? []).length);

      const { data: tData, error: tErr } = await supabase
        .schema('public')
        .from('teams')
        .select('team_id, team_name, short_name, logo');

      if (tErr) {
        setErr((prev) => (prev ? `${prev} | ${tErr.message}` : tErr.message));
        setTeams([]);
        dbg('Load teams FAILED:', tErr);
        return;
      }
      setTeams((tData ?? []) as TeamRow[]);
      dbg('Teams loaded:', (tData ?? []).length);
    })();
  }, [matchId]);

  const playerNames = useMemo(() => players.map((p) => p.full_name), [players]);

  const teamByName = useMemo(() => {
    const m = new Map<string, TeamRow>();
    for (const t of teams) m.set(t.team_name, t);
    return m;
  }, [teams]);

  const homeFull = match?.home_team ?? 'Home Team';
  const awayFull = match?.away_team ?? 'Away Team';

  const homeTeam = teamByName.get(homeFull);
  const awayTeam = teamByName.get(awayFull);

  const homeTeamName = homeTeam?.short_name || homeFull;
  const awayTeamName = awayTeam?.short_name || awayFull;

  const homeLogoUrl = homeTeam?.logo ? `${ASSETS_BASE}${homeTeam.logo}` : null;
  const awayLogoUrl = awayTeam?.logo ? `${ASSETS_BASE}${awayTeam.logo}` : null;

  const matchTitle = match?.match_name || match?.dated_name || `Match ${matchId}`;
  const competitionName = match?.competition ?? '';
  const formatName = match?.format ?? '';

  const isTest = (formatName ?? '').toLowerCase() === 'test';

  const battingSecondName = useMemo(() => {
    if (!battingFirst) return '';
    if (battingFirst === homeTeamName) return awayTeamName;
    if (battingFirst === awayTeamName) return homeTeamName;
    return '';
  }, [battingFirst, homeTeamName, awayTeamName]);

  const pomOptions = useMemo(() => {
    const uniq = getUniqueEnteredPlayers(firstBat, secondBat, firstBowl, secondBowl);
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [firstBat, secondBat, firstBowl, secondBowl]);

  useEffect(() => {
    if (playerOfMatch && !pomOptions.includes(playerOfMatch)) setPlayerOfMatch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomOptions.join('|')]);

  const showRest = battingFirst.trim() !== '';

  function validateWicketsInput(label: string, v: string): { ok: true } | { ok: false; msg: string } {
    if (v.trim() === '') return { ok: true };
    const n = toIntOrNull(v);
    if (n === null || n < 0) return { ok: false, msg: `Submission Failed: ${label} must be a non-negative integer.` };
    if (n > 10) return { ok: false, msg: `Submission Failed: ${label} cannot exceed 10.` };
    return { ok: true };
  }

  function validateBattingTablesDetailed(): { ok: true } | { ok: false; msg: string } {
    const check = (label: string, rows: BatRow[]) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;
        const name = (r.player_name ?? '').trim();
        if (name === '') continue;

        if (r.dnb) continue;

        // TEMPORARY: relaxed validation for testing (keep as comment)
        // const missingCols: string[] = [];
        // if (isEmpty(r.method)) missingCols.push('Method of Dismissal');
        // if (isEmpty(r.runs)) missingCols.push('Runs Scored');
        // if (isEmpty(r.balls)) missingCols.push('Balls Faced');
        // if (isEmpty(r.fours)) missingCols.push('4s');
        // if (isEmpty(r.sixes)) missingCols.push('6s');
        //
        // if (missingCols.length > 0) {
        //   return {
        //     ok: false as const,
        //     msg: `Submission Failed: ${label} row ${rowNum} (${name}) is missing: ${missingCols.join(', ')}.\nEither fill these fields or select DNB.`,
        //   };
        // }

        // TEMPORARY: relaxed dismissal detail validation for testing (keep as comment)
        // if (r.method === 'Bowled' || r.method === 'LBW (Leg Before Wicket)') {
        //   if (isEmpty(r.dis1)) {
        //     return {
        //       ok: false as const,
        //       msg: `Submission Failed: ${label} row ${rowNum} (${name}) needs dismissal detail:\n- Select the bowler name.`,
        //     };
        //   }
        // }
        // if (r.method === 'Run-out') {
        //   if (isEmpty(r.dis1) || isEmpty(r.dis2)) {
        //     return {
        //       ok: false as const,
        //       msg: `Submission Failed: ${label} row ${rowNum} (${name}) needs dismissal detail:\n- Run-out requires TWO fielders (both boxes).`,
        //     };
        //   }
        // }
        // if (r.method === 'Caught') {
        //   if (isEmpty(r.dis2) || isEmpty(r.dis1)) {
        //     return {
        //       ok: false as const,
        //       msg: `Submission Failed: ${label} row ${rowNum} (${name}) needs dismissal detail:\n- Caught requires BOTH c (catcher) and b (bowler).`,
        //     };
        //   }
        // }
        // if (r.method === 'Stumped') {
        //   if (isEmpty(r.dis2) || isEmpty(r.dis1)) {
        //     return {
        //       ok: false as const,
        //       msg: `Submission Failed: ${label} row ${rowNum} (${name}) needs dismissal detail:\n- Stumped requires BOTH st (stumper) and b (bowler).`,
        //     };
        //   }
        // }
      }

      return { ok: true as const };
    };

    const a = check(`First innings batting (${battingFirst || 'batting first team'})`, firstBat);
    if (!a.ok) return a;
    const b = check(`Second innings batting (${battingSecondName || 'batting second team'})`, secondBat);
    if (!b.ok) return b;

    return { ok: true };
  }

  function validateBeforeSubmit(): { ok: true; payload: any } | { ok: false; msg: string } {
    const w1 = validateWicketsInput(`${homeTeamName} wickets (header)`, homeWkts);
    if (!w1.ok) return w1;
    const w2 = validateWicketsInput(`${awayTeamName} wickets (header)`, awayWkts);
    if (!w2.ok) return w2;

    for (const [i, r] of firstBowl.entries()) {
      const v = validateWicketsInput(`First bowling card row ${i + 1} wickets`, r.wickets);
      if (!v.ok) return v;
    }
    for (const [i, r] of secondBowl.entries()) {
      const v = validateWicketsInput(`Second bowling card row ${i + 1} wickets`, r.wickets);
      if (!v.ok) return v;
    }

    const uniqPlayers = getUniqueEnteredPlayers(firstBat, secondBat, firstBowl, secondBowl);

    if (uniqPlayers.length > 24) {
      return { ok: false, msg: `Submission Failed: You have ${uniqPlayers.length} unique players.\nMax allowed is 24.` };
    }

    // TEMPORARY: remove minimum players constraint for testing (keep as comment)
    // if (winner !== 'NR' && uniqPlayers.length < 22) {
    //   return {
    //     ok: false,
    //     msg: `Submission Failed: Match result is not NR, so we need at least 22 unique players.\nCurrently found ${uniqPlayers.length}:\n- ${uniqPlayers.join('\n- ')}`,
    //   };
    // }

    const batDetail = validateBattingTablesDetailed();
    if (!batDetail.ok) return batDetail;

    const payload = {
      match_id: matchId,
      overview: {
        competition: competitionName,
        match_name: matchTitle,
        format: formatName,
        home_team: homeTeamName,
        away_team: awayTeamName,
      },

      match_summary: {
        home: { score: homeScore.trim(), wickets: homeWkts.trim(), overs: homeOvers.trim() },
        away: { score: awayScore.trim(), wickets: awayWkts.trim(), overs: awayOvers.trim() },
        winner,
        toss_winner: tossWinner.trim() === '' ? null : tossWinner.trim(),
        batting_first: battingFirst.trim() === '' ? null : battingFirst.trim(),
      },

      first_innings: {
        batting_team: battingFirst,
        bowling_team: battingSecondName,
        batting_card: firstBat.map((r, idx) => ({
          row_idx: idx + 1,
          player_name: r.player_name.trim() || null,
          did_not_bat: r.dnb,
          method: r.method || null,
          dismissal_1: r.dis1.trim() || null,
          dismissal_2: r.dis2.trim() || null,
          runs: toIntOrNull(r.runs),
          balls: toIntOrNull(r.balls),
          minutes: toIntOrNull(r.minutes),
          fours: toIntOrNull(r.fours),
          sixes: toIntOrNull(r.sixes),
          is_captain: firstBatCaptainIdx === idx,
          is_keeper: firstBatKeeperIdx === idx,
        })),
        bowling_card: firstBowl.map((r, idx) => ({
          row_idx: idx + 1,
          player_name: r.player_name.trim() || null,
          balls: toIntOrNull(r.balls),
          maidens: toIntOrNull(r.maidens),
          runs_conceded: toIntOrNull(r.runs_conceded),
          wickets: toIntOrNull(r.wickets),
          dots: toIntOrNull(r.dots),
          wides: toIntOrNull(r.wides),
          no_balls: toIntOrNull(r.no_balls),
        })),
      },

      second_innings: {
        batting_team: battingSecondName,
        bowling_team: battingFirst,
        batting_card: secondBat.map((r, idx) => ({
          row_idx: idx + 1,
          player_name: r.player_name.trim() || null,
          did_not_bat: r.dnb,
          method: r.method || null,
          dismissal_1: r.dis1.trim() || null,
          dismissal_2: r.dis2.trim() || null,
          runs: toIntOrNull(r.runs),
          balls: toIntOrNull(r.balls),
          minutes: toIntOrNull(r.minutes),
          fours: toIntOrNull(r.fours),
          sixes: toIntOrNull(r.sixes),
          is_captain: secondBatCaptainIdx === idx,
          is_keeper: secondBatKeeperIdx === idx,
        })),
        bowling_card: secondBowl.map((r, idx) => ({
          row_idx: idx + 1,
          player_name: r.player_name.trim() || null,
          balls: toIntOrNull(r.balls),
          maidens: toIntOrNull(r.maidens),
          runs_conceded: toIntOrNull(r.runs_conceded),
          wickets: toIntOrNull(r.wickets),
          dots: toIntOrNull(r.dots),
          wides: toIntOrNull(r.wides),
          no_balls: toIntOrNull(r.no_balls),
        })),
      },

      player_of_match: playerOfMatch.trim() === '' ? null : playerOfMatch.trim(),
    };

    return { ok: true, payload };
  }

  async function onSubmit(e?: React.MouseEvent<HTMLButtonElement>) {
    try {
      e?.preventDefault();
      e?.stopPropagation();
    } catch {}

    if (submitting) return;

    setSubmitting(true);

    try {
      dbg('Submit clicked ✅', {
        matchId,
        showRest,
        winner,
        tossWinner,
        battingFirst,
        playerOfMatch,
      });

      setToast(null);

      const v = validateBeforeSubmit();
      dbg('Validation result:', v.ok ? 'OK' : 'FAILED', v.ok ? undefined : v.msg);

      if (!v.ok) {
        setToast({ kind: 'err', msg: v.msg });
        return;
      }

      // ✅ Auth/session check right before any RPC
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      dbg('Session check:', {
        hasSession: !!sess?.session,
        userId: sess?.session?.user?.id ?? null,
        sessErr: sessErr?.message ?? null,
      });

      if (!sess?.session) {
        setToast({ kind: 'err', msg: 'Not signed in (no session). Please sign in again and retry.' });
        return;
      }

      // Debug payload preview
      dbg('Payload preview:', {
        match_id: v.payload.match_id,
        overview: v.payload.overview,
        match_summary: v.payload.match_summary,
        firstBatRows: v.payload.first_innings?.batting_card?.length,
        firstBowlRows: v.payload.first_innings?.bowling_card?.length,
        secondBatRows: v.payload.second_innings?.batting_card?.length,
        secondBowlRows: v.payload.second_innings?.bowling_card?.length,
        pom: v.payload.player_of_match,
      });

      try {
        // Optional tiny "ping" to prove PostgREST is alive BEFORE RPC
        dbg('Ping: selecting match_id from v_matches_overview …');
        const ping = await withTimeout(
          supabase.schema('public').from('v_matches_overview').select('match_id').eq('match_id', matchId).maybeSingle(),
          8000,
          'ping v_matches_overview'
        );
        dbg('Ping returned:', ping.error ? { error: ping.error } : { ok: true });

        if (ping.error) {
          setToast({ kind: 'err', msg: `API Ping Failed: ${ping.error.message}` });
          return;
        }

        // CALL MATCH-LEVEL RPC FIRST
        const t1 = Date.now();
        dbg('Calling RPC: public.user_submit_match_data …', { ts: new Date(t1).toISOString() });

        const r1 = await withTimeout(
          supabase.schema('public').rpc('user_submit_match_data', { p_payload: v.payload }),
          20000,
          'user_submit_match_data'
        );

        const t2 = Date.now();
        dbg('RPC user_submit_match_data returned:', { ms: t2 - t1, r1 });

        if ((r1 as any)?.error) {
          setToast({ kind: 'err', msg: `Submission Failed (match data): ${(r1 as any).error.message}` });
          return;
        }

        // THEN CALL SCORECARD RPC
        const t3 = Date.now();
        dbg('Calling RPC: public.user_submit_scorecard …', { ts: new Date(t3).toISOString() });

        // IMPORTANT: innings_id should default to NULL; server should handle it.
        // This is enforced in SQL, not here (payload contains nulls for missing numeric inputs already).

        const r2 = await withTimeout(
          supabase.schema('public').rpc('user_submit_scorecard', { p_payload: v.payload }),
          30000,
          'user_submit_scorecard'
        );

        const t4 = Date.now();
        dbg('RPC user_submit_scorecard returned:', { ms: t4 - t3, r2 });

        if ((r2 as any)?.error) {
          setToast({ kind: 'err', msg: `Submission Failed (scorecard): ${(r2 as any).error.message}` });
          return;
        }

        setToast({ kind: 'ok', msg: 'Submission Recorded. Thank you for submitting data.' });
        dbg('Submission complete ✅');

        // NEW: hard refresh after successful submit
        window.location.reload();
      } catch (ex: any) {
        demonstrate:
        // If a call "hangs", timeout will throw here, and finally will reset submitting so you can retry.
        console.error('[add_match/[id]] RPC threw:', ex);
        setToast({
          kind: 'err',
          msg: `Submission Failed: ${ex?.message ?? 'Unknown error'}\n\n${safeStringifyError(ex)}`,
        });
      }
    } finally {
      // NEW: always recover client state so a second attempt works without hard refresh
      setSubmitting(false);
    }
  }

  if (err) return <div style={{ padding: 24, color: 'crimson' }}>Failed to load: {err}</div>;
  if (!match) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {toast ? <div style={toastBoxStyle(toast.kind)}>{toast.msg}</div> : null}

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 950 }}>{competitionName}</div>

        {/* CHANGED: format next to match name */}
        <div style={{ fontSize: 18, fontWeight: 850, marginTop: 6 }}>
          {matchTitle}
          {formatName ? <span style={{ opacity: 0.7, fontWeight: 800 }}> — {formatName}</span> : null}
        </div>

        {/* kept (unchanged) */}
        <div style={{ opacity: 0.8, marginTop: 4, fontWeight: 700 }}>{formatName}</div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900 }}>
            <TeamLogo src={homeLogoUrl} alt={homeTeamName} />
            {homeTeamName}
          </div>
          <div style={{ opacity: 0.5 }}>vs</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900 }}>
            <TeamLogo src={awayLogoUrl} alt={awayTeamName} />
            {awayTeamName}
          </div>
        </div>
      </div>

      {/* Score input block */}
      <div style={{ ...sectionCard, marginBottom: 14 }}>
        <ScoreLine
          teamName={homeTeamName}
          teamLogoUrl={homeLogoUrl}
          score={homeScore}
          wickets={homeWkts}
          overs={homeOvers}
          setScore={setHomeScore}
          setWickets={setHomeWkts}
          setOvers={setHomeOvers}
        />
        <ScoreLine
          teamName={awayTeamName}
          teamLogoUrl={awayLogoUrl}
          score={awayScore}
          wickets={awayWkts}
          overs={awayOvers}
          setScore={setAwayScore}
          setWickets={setAwayWkts}
          setOvers={setAwayOvers}
        />
      </div>

      {/* Winning team + toss + batting first */}
      <div style={{ ...sectionCard, marginBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Winning Team</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" checked={winner === 'HOME'} onChange={() => setWinner('HOME')} />
              {homeTeamName}
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" checked={winner === 'AWAY'} onChange={() => setWinner('AWAY')} />
              {awayTeamName}
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" checked={winner === 'TIE'} onChange={() => setWinner('TIE')} />
              Tie
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" checked={winner === 'NR'} onChange={() => setWinner('NR')} />
              NR
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={labelStyle}>Who won the toss</div>
            <select value={tossWinner} onChange={(e) => setTossWinner(e.target.value)} style={inputStyle}>
              <option value=""></option>
              <option value={homeTeamName}>{homeTeamName}</option>
              <option value={awayTeamName}>{awayTeamName}</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={labelStyle}>Team Batting First:</div>
            <select value={battingFirst} onChange={(e) => setBattingFirst(e.target.value)} style={inputStyle}>
              <option value=""></option>
              <option value={homeTeamName}>{homeTeamName}</option>
              <option value={awayTeamName}>{awayTeamName}</option>
            </select>
          </div>
        </div>
      </div>

      {!showRest ? null : (
        <>
          <div style={{ ...sectionCard, marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>Enter Scorecard Details</div>

            {/* First innings batting */}
            <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>{battingFirst}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
                <thead>
                  <tr>
                    <Th>Batter</Th>
                    <Th>Did Not Bat.</Th>
                    <Th>Method of Dismissal</Th>
                    <Th>Dismissal detail</Th>
                    <Th>Runs Scored</Th>
                    <Th>Balls Faced</Th>
                    {/* CHANGED: Minutes only if Test */}
                    {isTest ? <Th>Minutes</Th> : null}
                    <Th>4s</Th>
                    <Th>6s</Th>
                    <Th>Captained?</Th>
                    <Th>Kept?</Th>
                  </tr>
                </thead>
                <tbody>
                  {firstBat.map((r, idx) => (
                    <tr key={`fb-${idx}`}>
                      <Td>
                        <PlayerTypeahead
                          value={r.player_name}
                          onChange={(v) =>
                            setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, player_name: v } : x)))
                          }
                          players={playerNames}
                          listId={`players-fb-${idx}`}
                          placeholder="Type batter…"
                        />
                      </Td>

                      <Td>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={r.dnb}
                            onChange={(e) =>
                              setFirstBat((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, dnb: e.target.checked } : x))
                              )
                            }
                          />
                          DNB
                        </label>
                      </Td>

                      {r.dnb ? (
                        <>
                          {/* DNB colspan depends on minutes visibility */}
                          <Td colSpan={isTest ? 6 : 5} style={{ opacity: 0.6 }}>
                            (Did not bat)
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="first-captain"
                              checked={firstBatCaptainIdx === idx}
                              onChange={() => setFirstBatCaptainIdx(idx)}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="first-keeper"
                              checked={firstBatKeeperIdx === idx}
                              onChange={() => setFirstBatKeeperIdx(idx)}
                            />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td>
                            <select
                              value={r.method}
                              onChange={(e) =>
                                setFirstBat((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, method: e.target.value as DismissalMethod, dis1: '', dis2: '' } : x
                                  )
                                )
                              }
                              style={{ ...inputStyle, minWidth: 200 }}
                            >
                              <option value=""></option>
                              <option value="Bowled">Bowled</option>
                              <option value="Caught">Caught</option>
                              <option value="LBW (Leg Before Wicket)">LBW (Leg Before Wicket)</option>
                              <option value="Run-out">Run-out</option>
                              <option value="Stumped">Stumped</option>
                              <option value="Not Out">Not Out</option>
                              <option value="Other">Other</option>
                            </select>
                          </Td>

                          <Td>
                            <DismissalDetail
                              method={r.method}
                              dis1={r.dis1}
                              dis2={r.dis2}
                              setDis1={(v) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, dis1: v } : x)))
                              }
                              setDis2={(v) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, dis2: v } : x)))
                              }
                              players={playerNames}
                              listIdPrefix={`fb-dis-${idx}`}
                            />
                          </Td>

                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.runs}
                              onChange={(e) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, runs: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 120 }}
                            />
                          </Td>
                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.balls}
                              onChange={(e) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, balls: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 120 }}
                            />
                          </Td>

                          {/* CHANGED: Minutes only if Test */}
                          {isTest ? (
                            <Td>
                              <input
                                inputMode="numeric"
                                value={r.minutes}
                                onChange={(e) =>
                                  setFirstBat((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, minutes: e.target.value } : x))
                                  )
                                }
                                style={{ ...inputStyle, width: 190 }}
                                placeholder="Nullable"
                              />
                            </Td>
                          ) : null}

                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.fours}
                              onChange={(e) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, fours: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 90 }}
                            />
                          </Td>
                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.sixes}
                              onChange={(e) =>
                                setFirstBat((prev) => prev.map((x, i) => (i === idx ? { ...x, sixes: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 90 }}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="first-captain"
                              checked={firstBatCaptainIdx === idx}
                              onChange={() => setFirstBatCaptainIdx(idx)}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="first-keeper"
                              checked={firstBatKeeperIdx === idx}
                              onChange={() => setFirstBatKeeperIdx(idx)}
                            />
                          </Td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setFirstBat((prev) => {
                      if (prev.length >= 12) return prev;
                      return [...prev, ...makeBatRows(1)];
                    })
                  }
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Add 12th Man
                </button>
              </div>
            </div>

            <div style={{ height: 16 }} />

            {/* First innings bowling */}
            <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>{battingSecondName}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                <thead>
                  <tr>
                    <Th>Bowler</Th>
                    <Th>Balls Bowled</Th>
                    <Th>Maidens</Th>
                    <Th>Runs Conceded</Th>
                    <Th>Wickets</Th>
                    <Th>Dots Bowled</Th>
                    <Th>Wides Bowled</Th>
                    <Th>No Balls Bowled</Th>
                  </tr>
                </thead>
                <tbody>
                  {firstBowl.map((r, idx) => (
                    <tr key={`fbo-${idx}`}>
                      <Td>
                        <PlayerTypeahead
                          value={r.player_name}
                          onChange={(v) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, player_name: v } : x)))
                          }
                          players={playerNames}
                          listId={`players-fbo-${idx}`}
                          placeholder="Type bowler…"
                          minWidth={240}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.balls}
                          onChange={(e) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, balls: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.maidens}
                          onChange={(e) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, maidens: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.runs_conceded}
                          onChange={(e) =>
                            setFirstBowl((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, runs_conceded: e.target.value } : x))
                            )
                          }
                          style={{ ...inputStyle, width: 160 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.wickets}
                          onChange={(e) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, wickets: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.dots}
                          onChange={(e) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, dots: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.wides}
                          onChange={(e) =>
                            setFirstBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, wides: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.no_balls}
                          onChange={(e) =>
                            setFirstBowl((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, no_balls: e.target.value } : x))
                            )
                          }
                          style={{ ...inputStyle, width: 160 }}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setFirstBowl((prev) => {
                      if (prev.length >= 11) return prev;
                      return [...prev, ...makeBowlRows(1)];
                    })
                  }
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  + Add row
                </button>
                <span style={{ marginLeft: 10, opacity: 0.7 }}>(Up to 11 rows)</span>
              </div>
            </div>
          </div>

          <div style={{ height: 18 }} />

          {/* Second innings */}
          <div style={{ ...sectionCard, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>Enter Second Innings Details</div>

            <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>{battingSecondName}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1300 }}>
                <thead>
                  <tr>
                    <Th>Batter</Th>
                    <Th>Did Not Bat.</Th>
                    <Th>Method of Dismissal</Th>
                    <Th>Dismissal detail</Th>
                    <Th>Runs Scored</Th>
                    <Th>Balls Faced</Th>
                    {/* CHANGED: Minutes only if Test */}
                    {isTest ? <Th>Minutes</Th> : null}
                    <Th>4s</Th>
                    <Th>6s</Th>
                    <Th>Captained?</Th>
                    <Th>Kept?</Th>
                  </tr>
                </thead>
                <tbody>
                  {secondBat.map((r, idx) => (
                    <tr key={`sb-${idx}`}>
                      <Td>
                        <PlayerTypeahead
                          value={r.player_name}
                          onChange={(v) =>
                            setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, player_name: v } : x)))
                          }
                          players={playerNames}
                          listId={`players-sb-${idx}`}
                          placeholder="Type batter…"
                        />
                      </Td>

                      <Td>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={r.dnb}
                            onChange={(e) =>
                              setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, dnb: e.target.checked } : x)))
                            }
                          />
                          DNB
                        </label>
                      </Td>

                      {r.dnb ? (
                        <>
                          <Td colSpan={isTest ? 6 : 5} style={{ opacity: 0.6 }}>
                            (Did not bat)
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="second-captain"
                              checked={secondBatCaptainIdx === idx}
                              onChange={() => setSecondBatCaptainIdx(idx)}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="second-keeper"
                              checked={secondBatKeeperIdx === idx}
                              onChange={() => setSecondBatKeeperIdx(idx)}
                            />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td>
                            <select
                              value={r.method}
                              onChange={(e) =>
                                setSecondBat((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, method: e.target.value as DismissalMethod, dis1: '', dis2: '' } : x
                                  )
                                )
                              }
                              style={{ ...inputStyle, minWidth: 200 }}
                            >
                              <option value=""></option>
                              <option value="Bowled">Bowled</option>
                              <option value="Caught">Caught</option>
                              <option value="LBW (Leg Before Wicket)">LBW (Leg Before Wicket)</option>
                              <option value="Run-out">Run-out</option>
                              <option value="Stumped">Stumped</option>
                              <option value="Not Out">Not Out</option>
                              <option value="Other">Other</option>
                            </select>
                          </Td>

                          <Td>
                            <DismissalDetail
                              method={r.method}
                              dis1={r.dis1}
                              dis2={r.dis2}
                              setDis1={(v) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, dis1: v } : x)))
                              }
                              setDis2={(v) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, dis2: v } : x)))
                              }
                              players={playerNames}
                              listIdPrefix={`sb-dis-${idx}`}
                            />
                          </Td>

                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.runs}
                              onChange={(e) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, runs: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 120 }}
                            />
                          </Td>
                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.balls}
                              onChange={(e) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, balls: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 120 }}
                            />
                          </Td>

                          {/* CHANGED: Minutes only if Test */}
                          {isTest ? (
                            <Td>
                              <input
                                inputMode="numeric"
                                value={r.minutes}
                                onChange={(e) =>
                                  setSecondBat((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, minutes: e.target.value } : x))
                                  )
                                }
                                style={{ ...inputStyle, width: 190 }}
                                placeholder="Nullable"
                              />
                            </Td>
                          ) : null}

                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.fours}
                              onChange={(e) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, fours: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 90 }}
                            />
                          </Td>
                          <Td>
                            <input
                              inputMode="numeric"
                              value={r.sixes}
                              onChange={(e) =>
                                setSecondBat((prev) => prev.map((x, i) => (i === idx ? { ...x, sixes: e.target.value } : x)))
                              }
                              style={{ ...inputStyle, width: 90 }}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="second-captain"
                              checked={secondBatCaptainIdx === idx}
                              onChange={() => setSecondBatCaptainIdx(idx)}
                            />
                          </Td>
                          <Td>
                            <input
                              type="radio"
                              name="second-keeper"
                              checked={secondBatKeeperIdx === idx}
                              onChange={() => setSecondBatKeeperIdx(idx)}
                            />
                          </Td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setSecondBat((prev) => {
                      if (prev.length >= 12) return prev;
                      return [...prev, ...makeBatRows(1)];
                    })
                  }
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Add 12th Man
                </button>
              </div>
            </div>

            <div style={{ height: 16 }} />

            {/* Second innings bowling */}
            <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>{battingFirst}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                <thead>
                  <tr>
                    <Th>Bowler</Th>
                    <Th>Balls Bowled</Th>
                    <Th>Maidens</Th>
                    <Th>Runs Conceded</Th>
                    <Th>Wickets</Th>
                    <Th>Dots Bowled</Th>
                    <Th>Wides Bowled</Th>
                    <Th>No Balls Bowled</Th>
                  </tr>
                </thead>
                <tbody>
                  {secondBowl.map((r, idx) => (
                    <tr key={`sbo-${idx}`}>
                      <Td>
                        <PlayerTypeahead
                          value={r.player_name}
                          onChange={(v) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, player_name: v } : x)))
                          }
                          players={playerNames}
                          listId={`players-sbo-${idx}`}
                          placeholder="Type bowler…"
                          minWidth={240}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.balls}
                          onChange={(e) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, balls: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.maidens}
                          onChange={(e) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, maidens: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.runs_conceded}
                          onChange={(e) =>
                            setSecondBowl((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, runs_conceded: e.target.value } : x))
                            )
                          }
                          style={{ ...inputStyle, width: 160 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.wickets}
                          onChange={(e) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, wickets: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.dots}
                          onChange={(e) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, dots: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.wides}
                          onChange={(e) =>
                            setSecondBowl((prev) => prev.map((x, i) => (i === idx ? { ...x, wides: e.target.value } : x)))
                          }
                          style={{ ...inputStyle, width: 140 }}
                        />
                      </Td>
                      <Td>
                        <input
                          inputMode="numeric"
                          value={r.no_balls}
                          onChange={(e) =>
                            setSecondBowl((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, no_balls: e.target.value } : x))
                            )
                          }
                          style={{ ...inputStyle, width: 160 }}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    setSecondBowl((prev) => {
                      if (prev.length >= 11) return prev;
                      return [...prev, ...makeBowlRows(1)];
                    })
                  }
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  + Add row
                </button>
                <span style={{ marginLeft: 10, opacity: 0.7 }}>(Up to 11 rows)</span>
              </div>
            </div>
          </div>

          {/* Break + Player of match + Submit */}
          <div style={{ ...sectionCard }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 950 }}>Player of the Match:</div>
              <select
                value={playerOfMatch}
                onChange={(e) => setPlayerOfMatch(e.target.value)}
                style={{ ...inputStyle, maxWidth: 520 }}
              >
                <option value=""></option>
                {pomOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ height: 14 }} />

            <button
              type="button"
              onClick={(e) => onSubmit(e)}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px 14px',
                borderRadius: 12,
                border: '1px solid #ddd',
                background: '#fff',
                fontWeight: 950,
                fontSize: 16,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                position: 'relative',
                zIndex: 10,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>

            {/* CHANGED: removed debug text */}
          </div>
        </>
      )}
    </div>
  );
}
