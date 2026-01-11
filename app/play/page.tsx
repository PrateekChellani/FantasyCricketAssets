'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TeamSubmitModal } from '../modals/TeamSubmitModal';

type Gameweek = {
  gameweek_id: number;
  name: string;
  start_ts: string;
  end_ts: string;
};

type Competition = {
  competition_id: number;
  competition_instance_id: number; // <-- added
  gameweek_id: number;
  template_id: number;

  competition_name: string;
  competition_description: string | null;

  entry_fee: number | null;
  prize: number | null;

  template_key: string;
  template_name: string;
  template_description: string | null;
  team_size_max: number;
  enforce_team_rules: boolean;
  only_format: string | null;
  allow_multi_entry: boolean;
};

type OwnedCardRow = {
  ownership_id: number;
  card_id: number;
  user_id: string;
  acquired_on: string;
  is_active: boolean;
  burned_on: string | null;
  is_current: boolean;

  player_id: number;
  card_type: string;
  edition: string | null;
  minted_on: string;
  points_earned: string | number;
  matches_selected: number;

  full_name: string;
  role: string | null;
  country_id: number | null;
  image: string | null;
  player_active: boolean | null;
};

type TeamSubmissionRow = {
  submission_id: number;
  user_id: string;
  competition_id: number;
  gameweek_id: number;
  template_id: number;
  created_at: string;
  updated_at: string | null;
  locked_at: string | null;
  is_valid: boolean | null;
  total_points: string | number | null;
  captain_card_id: number | null;
  vice_captain_card_id: number | null;
};

type TeamSubmissionCardRow = {
  submission_id: number;
  card_id: number;
  player_id: number | null;
  user_id: string | null;
  gameweek_id: number | null;
  template_id: number | null;
  created_at: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
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

function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

function hasStarted(gameweekStartTs: string) {
  const start = new Date(gameweekStartTs).getTime();
  if (!Number.isFinite(start)) return false;
  return Date.now() >= start;
}

export default function PlayHomePage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [upcomingGW, setUpcomingGW] = useState<Gameweek | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const [openComp, setOpenComp] = useState<Competition | null>(null);

  // EDIT MODE state (when opening modal via "View Team")
  const [openEditSubmissionId, setOpenEditSubmissionId] = useState<number | null>(null);

  // My submissions + submission cards for this gameweek
  const [mySubs, setMySubs] = useState<TeamSubmissionRow[]>([]);
  const [mySubCards, setMySubCards] = useState<TeamSubmissionCardRow[]>([]);

  // Card lookup for avatar strip (from v_my_player_cards)
  const [myCards, setMyCards] = useState<OwnedCardRow[]>([]);

  // tick for countdowns
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

      try {
        const { data: gw, error: gwErr } = await supabase
          .from('gameweeks')
          .select('gameweek_id,name,start_ts,end_ts')
          .gt('start_ts', nowIso())
          .order('start_ts', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (gwErr) {
          setBanner({ kind: 'error', msg: `Failed to load upcoming gameweek: ${gwErr.message}` });
          return;
        }

        setUpcomingGW((gw as any) ?? null);

        if (!gw) {
          setCompetitions([]);
          return;
        }

        const { data: comps, error: compErr } = await supabase
          .from('v_competitions_ui')
          .select(
            `
          competition_id,
          competition_instance_id,
          gameweek_id,
          template_id,
          competition_name,
          competition_description,
          entry_fee,
          prize,
          template_key,
          template_name,
          template_description,
          only_format,
          allow_multi_entry,
          enforce_team_rules,
          team_size_max
        `
          )
          .eq('gameweek_id', (gw as any).gameweek_id)
          .order('competition_id', { ascending: true });

        if (compErr) {
          setBanner({ kind: 'error', msg: `Failed to load competitions: ${compErr.message}` });
          setCompetitions([]);
        } else {
          setCompetitions(((comps as any) ?? []) as Competition[]);
        }
      } catch (e: any) {
        setBanner({ kind: 'error', msg: e?.message ?? 'Failed to load play page.' });
        setCompetitions([]);
        setUpcomingGW(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load: my cards (for avatars) + my submissions for the upcoming gameweek
  useEffect(() => {
    if (!userId || !upcomingGW) return;

    (async () => {
      try {
        const { data: cards, error: cardErr } = await supabase
          .from('v_my_player_cards')
          .select(
            `
            ownership_id,
            card_id,
            user_id,
            acquired_on,
            is_active,
            burned_on,
            is_current,
            player_id,
            card_type,
            edition,
            minted_on,
            points_earned,
            matches_selected,
            full_name,
            role,
            country_id,
            image,
            player_active
          `
          )
          .eq('user_id', userId)
          .eq('is_current', true);

        if (cardErr) throw cardErr;
        setMyCards(((cards as any) ?? []) as OwnedCardRow[]);

        const { data: subs, error: subErr } = await supabase
          .from('team_submissions')
          .select(
            `
            submission_id,
            user_id,
            competition_id,
            gameweek_id,
            template_id,
            created_at,
            updated_at,
            locked_at,
            is_valid,
            total_points,
            captain_card_id,
            vice_captain_card_id
          `
          )
          .eq('user_id', userId)
          .eq('gameweek_id', upcomingGW.gameweek_id)
          .order('created_at', { ascending: true });

        if (subErr) throw subErr;

        const subRows = (((subs as any) ?? []) as TeamSubmissionRow[]).filter((r) => !!r.submission_id);
        setMySubs(subRows);

        if (subRows.length === 0) {
          setMySubCards([]);
          return;
        }

        const subIds = subRows.map((s) => s.submission_id);

        const { data: sc, error: scErr } = await supabase
          .from('team_submission_cards')
          .select(
            `
            submission_id,
            card_id,
            player_id,
            user_id,
            gameweek_id,
            template_id,
            created_at
          `
          )
          .in('submission_id', subIds)
          .order('created_at', { ascending: true });

        if (scErr) throw scErr;
        setMySubCards(((sc as any) ?? []) as TeamSubmissionCardRow[]);
      } catch (e: any) {
        setBanner({ kind: 'error', msg: e?.message ?? 'Failed to load submissions.' });
      }
    })();
  }, [userId, upcomingGW?.gameweek_id]);

  const cardById = useMemo(() => {
    const m = new Map<number, OwnedCardRow>();
    for (const c of myCards) m.set(c.card_id, c);
    return m;
  }, [myCards]);

  // group submissions by competition_id
  const subsByComp = useMemo(() => {
    const map = new Map<number, TeamSubmissionRow[]>();
    for (const s of mySubs) {
      const arr = map.get(s.competition_id) ?? [];
      arr.push(s);
      map.set(s.competition_id, arr);
    }
    return map;
  }, [mySubs]);

  // cards per submission, ordered by created_at
  const cardIdsBySubmission = useMemo(() => {
    const map = new Map<number, number[]>();
    const grouped = new Map<number, TeamSubmissionCardRow[]>();
    for (const r of mySubCards) {
      const arr = grouped.get(r.submission_id) ?? [];
      arr.push(r);
      grouped.set(r.submission_id, arr);
    }
    for (const [sid, arr] of grouped.entries()) {
      arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
      map.set(
        sid,
        arr.map((x) => Number(x.card_id)).filter((x) => Number.isFinite(x))
      );
    }
    return map;
  }, [mySubCards]);

  const startMs = upcomingGW ? new Date(upcomingGW.start_ts).getTime() - Date.now() : 0;
  const endMs = upcomingGW ? new Date(upcomingGW.end_ts).getTime() - Date.now() : 0;
  void tick;
  void endMs;

  const competitionHasStarted = upcomingGW ? hasStarted(upcomingGW.start_ts) : false;

  async function deleteSubmission(submissionId: number) {
    if (!upcomingGW) return;

    if (competitionHasStarted) {
      setBanner({ kind: 'error', msg: 'Competition has already started' });
      return;
    }

    try {
      const { error: delCardsErr } = await supabase.from('team_submission_cards').delete().eq('submission_id', submissionId);
      if (delCardsErr) throw delCardsErr;

      const { error: delSubErr } = await supabase.from('team_submissions').delete().eq('submission_id', submissionId);
      if (delSubErr) throw delSubErr;

      setMySubCards((prev) => prev.filter((r) => r.submission_id !== submissionId));
      setMySubs((prev) => prev.filter((s) => s.submission_id !== submissionId));

      setBanner({ kind: 'success', msg: 'Team deleted.' });
    } catch (e: any) {
      setBanner({ kind: 'error', msg: e?.message ?? 'Failed to delete team.' });
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <h1 style={{ margin: 0 }}>Play</h1>
      <p style={{ marginTop: 6, color: '#555' }}>Upcoming gameweek + active competitions. Submit squads before the gameweek begins.</p>

      {banner && banner.msg && (
        <div
          style={{
            background: bannerColor(banner.kind),
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
            marginTop: 12,
          }}
        >
          {banner.msg}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading…</div>
      ) : !upcomingGW ? (
        <div style={{ marginTop: 18 }}>No upcoming gameweek found.</div>
      ) : (
        <>
          <div
            style={{
              marginTop: 18,
              padding: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#666' }}>Upcoming Gameweek</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{upcomingGW.name}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#666' }}>Starts in</div>
                <div style={{ fontWeight: 800 }}>{formatCountdown(startMs)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', color: '#666', fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 700, color: '#111' }}>Starts at:</span> {new Date(upcomingGW.start_ts).toLocaleString()}
              </div>
              <div>
                <span style={{ fontWeight: 700, color: '#111' }}>Ends at:</span> {new Date(upcomingGW.end_ts).toLocaleString()}
              </div>
            </div>
          </div>

          <h2 style={{ marginTop: 18 }}>Competitions</h2>

          {competitions.length === 0 ? (
            <div>No competitions for this gameweek.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {competitions.map((c) => {
                const teamSize = c.team_size_max ?? 6;
                const myForComp = subsByComp.get(c.competition_id) ?? [];

                return (
                  <div
                    key={c.competition_id}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: 14,
                      background: '#fff',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{c.competition_name}</div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{c.competition_description ?? c.template_description ?? '—'}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', textAlign: 'right' }}>
                        <div>Team Size</div>
                        <div style={{ fontWeight: 800, color: '#111' }}>{teamSize}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => {
                          if (!userId) {
                            setBanner({ kind: 'error', msg: 'Please sign in to submit a team.' });
                            return;
                          }
                          setOpenEditSubmissionId(null);
                          setOpenComp(c);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #111',
                          background: '#111',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Submit team
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = `/play/competitions/${c.competition_instance_id}`;
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #e5e5e5',
                          background: '#fff',
                          color: '#111',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View details
                      </button>
                    </div>

                    {userId && myForComp.length > 0 && (
                      <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                        {myForComp.map((s, idx) => {
                          const cardIds = cardIdsBySubmission.get(s.submission_id) ?? [];
                          const avatarIds = cardIds.slice(0, teamSize);

                          return (
                            <div
                              key={s.submission_id}
                              style={{
                                border: '1px solid #eee',
                                borderRadius: 12,
                                padding: 10,
                                background: '#fafafa',
                                display: 'grid',
                                gap: 10,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                                <div style={{ fontWeight: 900, fontSize: 13 }}>Team {idx + 1} submitted</div>
                                <div style={{ fontSize: 12, color: '#666' }}>{new Date(s.created_at).toLocaleString()}</div>
                              </div>

                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {avatarIds.map((cid) => {
                                  const card = cardById.get(cid);
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
                                        <img
                                          src={img}
                                          alt={card?.full_name ?? `Card ${cid}`}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                  onClick={() => {
                                    if (competitionHasStarted) {
                                      setBanner({ kind: 'error', msg: 'Competition has already started' });
                                      return;
                                    }
                                    setOpenEditSubmissionId(s.submission_id);
                                    setOpenComp(c);
                                  }}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    border: '1px solid #e5e5e5',
                                    background: '#fff',
                                    color: '#111',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  View Team
                                </button>

                                <button
                                  onClick={() => deleteSubmission(s.submission_id)}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    border: '1px solid #ef4444',
                                    background: '#fff',
                                    color: '#ef4444',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    marginLeft: 'auto',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {openComp && upcomingGW && userId && (
        <TeamSubmitModal
          userId={userId}
          competition={openComp as any}
          gameweek={upcomingGW as any}
          hasCompetitionStarted={hasStarted(upcomingGW.start_ts)}
          editSubmissionId={openEditSubmissionId}
          editPrefill={{
            cardIds: openEditSubmissionId ? cardIdsBySubmission.get(openEditSubmissionId) ?? [] : [],
            captainCardId: openEditSubmissionId ? mySubs.find((s) => s.submission_id === openEditSubmissionId)?.captain_card_id ?? null : null,
            viceCaptainCardId: openEditSubmissionId ? mySubs.find((s) => s.submission_id === openEditSubmissionId)?.vice_captain_card_id ?? null : null,
          }}
          onClose={() => {
            setOpenComp(null);
            setOpenEditSubmissionId(null);
          }}
          onSuccess={async (kind) => {
            setOpenComp(null);
            setOpenEditSubmissionId(null);
            setBanner({ kind: 'success', msg: kind === 'update' ? 'Team updated.' : 'Team successfully submitted.' });

            try {
              const { data: subs } = await supabase
                .from('team_submissions')
                .select(
                  `
                  submission_id,
                  user_id,
                  competition_id,
                  gameweek_id,
                  template_id,
                  created_at,
                  updated_at,
                  locked_at,
                  is_valid,
                  total_points,
                  captain_card_id,
                  vice_captain_card_id
                `
                )
                .eq('user_id', userId)
                .eq('gameweek_id', upcomingGW.gameweek_id)
                .order('created_at', { ascending: true });

              const subRows = (((subs as any) ?? []) as TeamSubmissionRow[]).filter((r) => !!r.submission_id);
              setMySubs(subRows);

              if (subRows.length > 0) {
                const subIds = subRows.map((s) => s.submission_id);
                const { data: sc } = await supabase
                  .from('team_submission_cards')
                  .select(
                    `
                    submission_id,
                    card_id,
                    player_id,
                    user_id,
                    gameweek_id,
                    template_id,
                    created_at
                  `
                  )
                  .in('submission_id', subIds)
                  .order('created_at', { ascending: true });

                setMySubCards(((sc as any) ?? []) as TeamSubmissionCardRow[]);
              } else {
                setMySubCards([]);
              }
            } catch {
              // non-fatal
            }
          }}
          onError={(msg) => setBanner({ kind: 'error', msg })}
        />
      )}
    </div>
  );
}
