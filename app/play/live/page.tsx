'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type Gameweek = {
  gameweek_id: number;
  name: string;
  start_ts: string; // timestamptz
  end_ts: string; // timestamptz
};

type CompetitionUiRow = {
  competition_id: number;
  competition_name: string;
  competition_description: string | null;
  team_size_max: number | null;
};

type SubmissionRow = {
  submission_id: number;
  competition_id: number;
  created_at: string;
  is_valid: boolean;
  captain_card_id: number | null;
  vice_captain_card_id: number | null;
};

type SubmissionCardRow = {
  submission_id: number;
  card_id: number;
  player_id: number | null;
};

type MyCardRow = {
  card_id: number;
  player_id: number;
  full_name: string;
  role: string | null;
  country_id: number | null; // teams.team_id
  image: string | null;
};

type TeamRow = {
  team_id: number;
  initials: string | null;
  logo: string | null;
};

type MatchRow = {
  id: number; // match_id
  team_home_logo: string | null;
  team_away_logo: string | null;
};

type PlayerGwPoints = {
  player_id: number;
  match_id: number;
  match_date: string; // YYYY-MM-DD
  points_total: number;
  points_batting: number;
  points_bowling: number;
  points_fielding: number;
  // misc not needed for hover, but harmless if you want later
};

function nowIso() {
  return new Date().toISOString();
}

function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

function formatCountdown(ms: number) {
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function toYmd(d: Date) {
  // local-date → YYYY-MM-DD (we’re just doing inclusive comparisons against match_date which is date-only)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseNum(v: any): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function LiveGameweekPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [gw, setGw] = useState<Gameweek | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionCards, setSubmissionCards] = useState<SubmissionCardRow[]>([]);

  const [competitionsUi, setCompetitionsUi] = useState<Map<number, CompetitionUiRow>>(new Map());

  const [myCards, setMyCards] = useState<MyCardRow[]>([]);
  const [teams, setTeams] = useState<Map<number, TeamRow>>(new Map());

  const [pointsRows, setPointsRows] = useState<PlayerGwPoints[]>([]);
  const [matchesById, setMatchesById] = useState<Map<number, MatchRow>>(new Map());

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // view modal
  const [openSubmissionId, setOpenSubmissionId] = useState<number | null>(null);

  // tick for countdown
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) Current (live) GW = start_ts <= now <= end_ts
        const { data: liveGw, error: gwErr } = await supabase
          .from('gameweeks')
          .select('gameweek_id,name,start_ts,end_ts')
          .lte('start_ts', nowIso())
          .gte('end_ts', nowIso())
          .order('start_ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (gwErr) throw new Error(gwErr.message);

        setGw(liveGw ?? null);

        // If no live GW, stop here
        if (!liveGw) {
          setSubmissions([]);
          setSubmissionCards([]);
          setPointsRows([]);
          setMatchesById(new Map());
          setCompetitionsUi(new Map());
          setLoading(false);
          return;
        }

        // If not signed in, we can still show the live GW header (no teams)
        if (!userId) {
          setSubmissions([]);
          setSubmissionCards([]);
          setPointsRows([]);
          setMatchesById(new Map());
          setCompetitionsUi(new Map());
          setLoading(false);
          return;
        }

        // 2) Load your submissions for this GW
        const { data: subs, error: subsErr } = await supabase
          .from('team_submissions')
          .select('submission_id,competition_id,created_at,is_valid,captain_card_id,vice_captain_card_id')
          .eq('user_id', userId)
          .eq('gameweek_id', liveGw.gameweek_id)
          .order('created_at', { ascending: true });

        if (subsErr) throw new Error(subsErr.message);

        const subRows = ((subs as any) ?? []) as SubmissionRow[];
        setSubmissions(subRows);

        if (subRows.length === 0) {
          setSubmissionCards([]);
          setPointsRows([]);
          setMatchesById(new Map());
          setCompetitionsUi(new Map());
          setLoading(false);
          return;
        }

        const submissionIds = subRows.map((s) => s.submission_id);

        // 3) Load selected cards for those submissions
        const { data: cards, error: cardsErr } = await supabase
          .from('team_submission_cards')
          .select('submission_id,card_id,player_id')
          .in('submission_id', submissionIds);

        if (cardsErr) throw new Error(cardsErr.message);

        const scRows = ((cards as any) ?? []) as SubmissionCardRow[];
        setSubmissionCards(scRows);

        // 4) Load competition names (for grouping + clickable comp)
        const compIds = Array.from(new Set(subRows.map((s) => s.competition_id).filter((x) => Number.isFinite(x))));
        if (compIds.length > 0) {
          const { data: compUi, error: compUiErr } = await supabase
            .from('v_competitions_ui')
            .select('competition_id,competition_name,competition_description,team_size_max')
            .in('competition_id', compIds);

          if (compUiErr) throw new Error(compUiErr.message);

          const m = new Map<number, CompetitionUiRow>();
          for (const r of ((compUi as any) ?? []) as any[]) {
            m.set(Number(r.competition_id), {
              competition_id: Number(r.competition_id),
              competition_name: String(r.competition_name ?? ''),
              competition_description: (r.competition_description ?? null) as any,
              team_size_max: r.team_size_max == null ? null : Number(r.team_size_max),
            });
          }
          setCompetitionsUi(m);
        } else {
          setCompetitionsUi(new Map());
        }

        // 5) Load my cards (names/images/role/country_id) from same source as My Players
        const { data: my, error: myErr } = await supabase
          .from('v_my_player_cards')
          .select('card_id,player_id,full_name,role,country_id,image')
          .eq('user_id', userId)
          .eq('is_current', true);

        if (myErr) throw new Error(myErr.message);

        const myRows = ((my as any) ?? []) as any[];
        setMyCards(
          myRows.map((r) => ({
            card_id: Number(r.card_id),
            player_id: Number(r.player_id),
            full_name: String(r.full_name ?? ''),
            role: (r.role ?? null) as any,
            country_id: r.country_id == null ? null : Number(r.country_id),
            image: (r.image ?? null) as any,
          }))
        );

        // 6) Load teams for initials (nationality)
        const { data: tRows, error: tErr } = await supabase.from('teams').select('team_id,initials,logo');
        if (tErr) throw new Error(tErr.message);

        const tMap = new Map<number, TeamRow>();
        for (const tr of ((tRows as any) ?? []) as any[]) {
          tMap.set(Number(tr.team_id), {
            team_id: Number(tr.team_id),
            initials: (tr.initials ?? null) as any,
            logo: (tr.logo ?? null) as any,
          });
        }
        setTeams(tMap);

        // 7) Load player match points for all players in submissions, then pick best row per player within GW window
        const playerIds = Array.from(new Set(scRows.map((r) => r.player_id).filter((x): x is number => !!x && Number.isFinite(x))));
        if (playerIds.length === 0) {
          setPointsRows([]);
          setMatchesById(new Map());
          setLoading(false);
          return;
        }

        // GW date window (inclusive)
        const gwStartYmd = toYmd(new Date(liveGw.start_ts));
        const gwEndYmd = toYmd(new Date(liveGw.end_ts));

        const { data: pts, error: ptsErr } = await supabase
          .from('v_player_match_points_detail')
          .select('match_id,match_date,player_id,points_total,points_batting,points_bowling,points_fielding')
          .in('player_id', playerIds);

        if (ptsErr) throw new Error(ptsErr.message);

        const allPts = (((pts as any) ?? []) as any[])
          .map((r) => ({
            player_id: Number(r.player_id),
            match_id: Number(r.match_id),
            match_date: String(r.match_date ?? ''),
            points_total: parseNum(r.points_total),
            points_batting: parseNum(r.points_batting),
            points_bowling: parseNum(r.points_bowling),
            points_fielding: parseNum(r.points_fielding),
          }))
          .filter((r) => r.match_date >= gwStartYmd && r.match_date <= gwEndYmd);

        setPointsRows(allPts);

        // 8) Load match logos for match_ids we might show
        const matchIds = Array.from(new Set(allPts.map((r) => r.match_id).filter((x) => Number.isFinite(x))));
        if (matchIds.length > 0) {
          const { data: ms, error: msErr } = await supabase
            .from('v_matches')
            .select('id,team_home_logo,team_away_logo')
            .in('id', matchIds);

          if (msErr) throw new Error(msErr.message);

          const mm = new Map<number, MatchRow>();
          for (const r of ((ms as any) ?? []) as any[]) {
            mm.set(Number(r.id), {
              id: Number(r.id),
              team_home_logo: (r.team_home_logo ?? null) as any,
              team_away_logo: (r.team_away_logo ?? null) as any,
            });
          }
          setMatchesById(mm);
        } else {
          setMatchesById(new Map());
        }
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Unknown error loading live gameweek.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // group cards by submission
  const cardsBySubmission = useMemo(() => {
    const acc: Record<number, SubmissionCardRow[]> = {};
    for (const row of submissionCards) {
      acc[row.submission_id] = acc[row.submission_id] ?? [];
      acc[row.submission_id].push(row);
    }
    // keep stable-ish ordering for display
    for (const k of Object.keys(acc)) {
      acc[Number(k)].sort((a, b) => a.card_id - b.card_id);
    }
    return acc;
  }, [submissionCards]);

  // group submissions by competition
  const subsByCompetition = useMemo(() => {
    const m = new Map<number, SubmissionRow[]>();
    for (const s of submissions) {
      const arr = m.get(s.competition_id) ?? [];
      arr.push(s);
      m.set(s.competition_id, arr);
    }
    return m;
  }, [submissions]);

  const cardInfoById = useMemo(() => {
    const m = new Map<number, MyCardRow>();
    for (const c of myCards) m.set(c.card_id, c);
    return m;
  }, [myCards]);

  // best points row per player (max points_total; tie -> first by match_date asc then match_id asc)
  const bestPointsByPlayer = useMemo(() => {
    const m = new Map<number, PlayerGwPoints>();
    const grouped = new Map<number, PlayerGwPoints[]>();
    for (const r of pointsRows) {
      const arr = grouped.get(r.player_id) ?? [];
      arr.push(r);
      grouped.set(r.player_id, arr);
    }
    for (const [pid, arr] of grouped.entries()) {
      arr.sort((a, b) => {
        const pt = b.points_total - a.points_total; // desc
        if (pt !== 0) return pt;
        if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date); // asc
        return a.match_id - b.match_id; // asc
      });
      m.set(pid, arr[0]);
    }
    return m;
  }, [pointsRows]);

  function computeSubmissionPoints(sub: SubmissionRow) {
    const rows = cardsBySubmission[sub.submission_id] ?? [];

    // captain/VC evaluation: VC bonus only if captain has no row at all
    const captainCardId = sub.captain_card_id ?? null;
    const viceCardId = sub.vice_captain_card_id ?? null;

    const captainPlayerId = captainCardId ? rows.find((r) => r.card_id === captainCardId)?.player_id ?? null : null;
    const captainHasRow = captainPlayerId ? bestPointsByPlayer.has(captainPlayerId) : false;

    const details = rows.map((r) => {
      const playerId = r.player_id ?? null;
      const base = playerId ? bestPointsByPlayer.get(playerId) ?? null : null;

      const basePoints = base ? base.points_total : null; // null => show "-"
      let multiplier = 1;

      if (captainCardId && r.card_id === captainCardId && base) multiplier = 2;
      if (!captainHasRow && viceCardId && r.card_id === viceCardId && base) multiplier = 1.5;

      const effectivePoints = base ? base.points_total * multiplier : 0;

      return {
        submission_id: sub.submission_id,
        card_id: r.card_id,
        player_id: playerId,
        base,
        basePoints,
        multiplier,
        effectivePoints,
        isCaptain: captainCardId ? r.card_id === captainCardId : false,
        isViceCaptain: viceCardId ? r.card_id === viceCardId : false,
      };
    });

    const total = details.reduce((sum, d) => sum + (Number.isFinite(d.effectivePoints) ? d.effectivePoints : 0), 0);

    return { totalPoints: total, details };
  }

  const openSub = openSubmissionId ? submissions.find((s) => s.submission_id === openSubmissionId) ?? null : null;

  const endMs = gw ? new Date(gw.end_ts).getTime() - Date.now() : 0;
  void tick;

  // colors
  const lavenderBg = '#f5f3ff';
  const lavenderBorder = '#e9d5ff';
  const ink = '#111';
  const inkSoft = '#555';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <h1 style={{ margin: 0 }}>Live</h1>
      <p style={{ marginTop: 6, color: '#555' }}>
        Shows your teams for the <b>current</b> gameweek. No edits here — just viewing.
      </p>

      {errorMsg && (
        <div
          style={{
            marginTop: 12,
            background: '#fee2e2',
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading…</div>
      ) : !gw ? (
        <div
          style={{
            marginTop: 18,
            border: '1px solid #e5e5e5',
            borderRadius: 14,
            background: '#fff',
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 800 }}>No active gameweek right now.</div>
          <div style={{ color: '#666', marginTop: 6 }}>Once a gameweek window is active, it’ll show up here.</div>
        </div>
      ) : (
        <>
          {/* Header card */}
          <div
            style={{
              marginTop: 18,
              padding: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Live Gameweek</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{gw.name}</div>

                <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 12, color: '#666' }}>
                  <div>
                    <b style={{ color: '#111' }}>Started:</b> {new Date(gw.start_ts).toLocaleString()}
                  </div>
                  <div>
                    <b style={{ color: '#111' }}>Ends:</b> {new Date(gw.end_ts).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#666' }}>Ends in</div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{formatCountdown(endMs)}</div>
              </div>
            </div>
          </div>

          {!userId ? (
            <div style={{ marginTop: 18, color: '#555' }}>Sign in to view your submissions for this gameweek.</div>
          ) : submissions.length === 0 ? (
            <div style={{ marginTop: 18, color: '#555' }}>You haven’t submitted any teams for this gameweek yet.</div>
          ) : (
            <>
              <h2 style={{ marginTop: 18 }}>Your submitted teams</h2>

              {Array.from(subsByCompetition.entries()).map(([compId, subs]) => {
                const comp = competitionsUi.get(compId);
                const compName = comp?.competition_name || `Competition ${compId}`;
                const teamSizeMax = comp?.team_size_max ?? 6;

                return (
                  <div
                    key={compId}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: 14,
                      background: '#fff',
                      padding: 14,
                      marginTop: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <Link
                        href={`/play/competitions/${compId}`}
                        style={{
                          fontWeight: 900,
                          color: '#111',
                          textDecoration: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {compName}
                      </Link>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        Teams: <b style={{ color: '#111' }}>{subs.length}</b>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                      {subs.map((s, idx) => {
                        const rows = cardsBySubmission[s.submission_id] ?? [];
                        const avatarCardIds = rows.slice(0, teamSizeMax).map((r) => r.card_id);

                        const { totalPoints } = computeSubmissionPoints(s);

                        return (
                          <div
                            key={s.submission_id}
                            style={{
                              border: '1px solid #eee',
                              borderRadius: 14,
                              background: '#fafafa',
                              padding: 12,
                              display: 'grid',
                              gap: 10,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontWeight: 900 }}>Team {idx + 1}</div>
                              <div style={{ fontSize: 12, color: '#666' }}>{new Date(s.created_at).toLocaleString()}</div>
                            </div>

                            {/* avatar strip */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {avatarCardIds.map((cid) => {
                                const card = cardInfoById.get(cid);
                                const img = assetUrl(card?.image ?? null);
                                return (
                                  <div
                                    key={cid}
                                    title={card?.full_name ?? `Card ${cid}`}
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      border: '1px solid #e5e5e5',
                                      background: '#fff',
                                    }}
                                  >
                                    {img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={img} alt={card?.full_name ?? `Card ${cid}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            {/* points strip (red-marked area) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontSize: 12, color: '#666' }}>
                                Valid: <b style={{ color: '#111' }}>{s.is_valid ? 'Yes' : 'No'}</b>
                              </div>
                              <div style={{ fontSize: 12, color: '#666' }}>
                                Total Team Points: <b style={{ color: '#111' }}>{Number.isFinite(totalPoints) ? totalPoints.toFixed(2) : '—'}</b>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                              <button
                                onClick={() => setOpenSubmissionId(s.submission_id)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  border: '1px solid #e5e5e5',
                                  background: '#fff',
                                  color: '#111',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                }}
                              >
                                View Team
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* VIEW-ONLY MODAL */}
      {gw && userId && openSub && (
        <ViewTeamModal
          submission={openSub}
          competitionName={competitionsUi.get(openSub.competition_id)?.competition_name ?? `Competition ${openSub.competition_id}`}
          teamSize={competitionsUi.get(openSub.competition_id)?.team_size_max ?? 6}
          cards={(cardsBySubmission[openSub.submission_id] ?? []).map((r) => r.card_id)}
          cardInfoById={cardInfoById}
          teamsById={teams}
          bestPointsByPlayer={bestPointsByPlayer}
          matchesById={matchesById}
          onClose={() => setOpenSubmissionId(null)}
          lavenderBg={lavenderBg}
          lavenderBorder={lavenderBorder}
          ink={ink}
          inkSoft={inkSoft}
          computeSubmissionPoints={computeSubmissionPoints}
        />
      )}
    </div>
  );
}

function ViewTeamModal(props: {
  submission: SubmissionRow;
  competitionName: string;
  teamSize: number;
  cards: number[]; // card_ids in submission order
  cardInfoById: Map<number, MyCardRow>;
  teamsById: Map<number, TeamRow>;
  bestPointsByPlayer: Map<number, PlayerGwPoints>;
  matchesById: Map<number, MatchRow>;
  onClose: () => void;

  lavenderBg: string;
  lavenderBorder: string;
  ink: string;
  inkSoft: string;

  computeSubmissionPoints: (sub: SubmissionRow) => {
    totalPoints: number;
    details: Array<{
      submission_id: number;
      card_id: number;
      player_id: number | null;
      base: PlayerGwPoints | null;
      basePoints: number | null;
      multiplier: number;
      effectivePoints: number;
      isCaptain: boolean;
      isViceCaptain: boolean;
    }>;
  };
}) {
  const { submission } = props;

  const { totalPoints, details } = props.computeSubmissionPoints(submission);

  // For display ordering: keep same order as submission cards list
  const detailByCard = useMemo(() => {
    const m = new Map<number, (typeof details)[number]>();
    for (const d of details) m.set(d.card_id, d);
    return m;
  }, [details]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          background: '#fff',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          border: `1px solid ${props.lavenderBorder}`,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 14, background: '#fff' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Viewing team for</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>{props.competitionName}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              Submission #{submission.submission_id} • Team Points: <b style={{ color: '#111' }}>{Number.isFinite(totalPoints) ? totalPoints.toFixed(2) : '—'}</b>
            </div>
          </div>

          <button
            onClick={props.onClose}
            aria-label="Close"
            style={{
              border: `1px solid ${props.lavenderBorder}`,
              background: props.lavenderBg,
              color: '#111',
              width: 40,
              height: 40,
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: 18,
              lineHeight: '40px',
              textAlign: 'center',
              flex: '0 0 auto',
            }}
          >
            ×
          </button>
        </div>

        {/* body (right panel style only) */}
        <div style={{ background: props.lavenderBg, borderTop: `1px solid ${props.lavenderBorder}`, padding: 14 }}>
          <div style={{ fontSize: 12, color: props.inkSoft, marginBottom: 10 }}>
            Players: <b style={{ color: props.ink }}>{props.cards.length}</b>
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${props.lavenderBorder}`,
              borderRadius: 14,
              padding: 10,
              maxHeight: 420,
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {props.cards.slice(0, props.teamSize).map((cardId) => {
                const info = props.cardInfoById.get(cardId);
                const d = detailByCard.get(cardId);

                const natInitials =
                  info?.country_id != null ? props.teamsById.get(info.country_id)?.initials ?? String(info.country_id) : '—';

                const img = assetUrl(info?.image ?? null);

                const base = d?.base ?? null;
                const pointsDisplay = base ? (d?.effectivePoints ?? 0) : null;

                const hover =
                  base
                    ? `Batting: ${base.points_batting.toFixed(2)} • Bowling: ${base.points_bowling.toFixed(2)} • Fielding: ${base.points_fielding.toFixed(2)}`
                    : '';

                const match = base ? props.matchesById.get(base.match_id) ?? null : null;
                const homeLogo = assetUrl(match?.team_home_logo ?? null);
                const awayLogo = assetUrl(match?.team_away_logo ?? null);

                return (
                  <div
                    key={cardId}
                    style={{
                      border: `1px solid ${props.lavenderBorder}`,
                      borderRadius: 14,
                      padding: 12,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      background: '#fff',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        overflow: 'hidden',
                        border: '1px solid #eee',
                        background: '#fff',
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={info?.full_name ?? `Card ${cardId}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <span style={{ color: '#999', fontSize: 11 }}>IMG</span>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 900, color: props.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {info?.full_name ?? `Card ${cardId}`}
                        </div>

                        {d?.isCaptain && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid #22c55e',
                              color: '#14532d',
                              background: 'rgba(34,197,94,0.10)',
                            }}
                          >
                            C
                          </span>
                        )}
                        {d?.isViceCaptain && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid #f59e0b',
                              color: '#7c2d12',
                              background: 'rgba(245,158,11,0.10)',
                            }}
                          >
                            VC
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: props.inkSoft, marginTop: 2 }}>
                        Role: <b style={{ color: props.ink }}>{info?.role ?? '—'}</b> • Nat: <b style={{ color: props.ink }}>{natInitials ?? '—'}</b>
                      </div>

                      <div style={{ fontSize: 12, color: props.inkSoft, marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span title={hover}>
                          Points this GW:{' '}
                          <b style={{ color: props.ink }}>
                            {pointsDisplay == null ? '—' : Number.isFinite(pointsDisplay) ? pointsDisplay.toFixed(2) : '—'}
                          </b>
                        </span>

                        {base && (
                          <Link
                            href={`/matches/points/${base.match_id}`}
                            title="View match points"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: props.ink, cursor: 'pointer' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {homeLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={homeLogo} alt="Home" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />
                              ) : null}
                              <span style={{ fontSize: 12, color: props.inkSoft }}>vs.</span>
                              {awayLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={awayLogo} alt="Away" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />
                              ) : null}
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: props.inkSoft }}>
            Hover on “Points this GW” to see Batting/Bowling/Fielding breakdown.
          </div>
        </div>
      </div>
    </div>
  );
}
