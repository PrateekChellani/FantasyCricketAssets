'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type GameweekRow = {
  gameweek_id: number;
  name: string;
  start_ts: string;
  end_ts: string;
};

type CompetitionUiRow = {
  competition_id: number;
  gameweek_id: number;
  template_id: number;

  competition_name: string;
  competition_description: string | null;

  template_key: string;
  template_name: string;
  template_description: string | null;

  only_format: string | null;

  // IMPORTANT: used for modals
  competition_instance_id: number | null;
};

type SubmissionRow = {
  submission_id: number;
  user_id: string;
  competition_id: number;
  gameweek_id: number;
  template_id: number | null;
  created_at: string;
};

type LeaderboardRow = {
  competition_instance_id: number;
  rank: number;
  submission_id: number;
  user_id: string;
  final_points: string | number | null;
  submitted_at: string | null;
};

type PrizePoolStaticRow = {
  competition_instance_id: number;

  prize_rule_id: number;
  rule_kind: string;
  rank_from: number | null;
  rank_to: number | null;
  percentile: string | number | null;
  priority: number | null;
  label: string | null;

  prize_item_id: number;
  prize_type: string;
  qty: number | null;
  cp_amount: string | number | null;
  pack_template_id: number | null;
  card_player_id: number | null;
};

type UserDisplayRow = {
  user_id: string;
  display_name: string;
  image?: string | null;
};

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
}

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function fmtPts(v: any): string {
  const n = toNum(v);
  if (n === null) return '—';
  return n.toFixed(2);
}

function shortId(id: string) {
  if (!id) return '—';
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function Modal(props: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  const { title, open, onClose, children, maxWidth } = props;
  if (!open) return null;

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(100%, ' + String(maxWidth ?? 900) + 'px)',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid #eee',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: '1px solid #e5e5e5',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: 18,
              lineHeight: '34px',
              textAlign: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export default function CompetitionsPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const [gameweeks, setGameweeks] = useState<GameweekRow[]>([]);
  const [gwIdx, setGwIdx] = useState(0);

  const [competitions, setCompetitions] = useState<CompetitionUiRow[]>([]);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);

  // Modals
  const [activeCiId, setActiveCiId] = useState<number | null>(null);
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);

  const [lbLoading, setLbLoading] = useState(false);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);

  const [prizeLoading, setPrizeLoading] = useState(false);
  const [prizeRows, setPrizeRows] = useState<PrizePoolStaticRow[]>([]);

  // NEW: user display lookup for leaderboard
  const [userDisplayById, setUserDisplayById] = useState<Map<string, UserDisplayRow>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // Load all gameweeks + pick initial GW (live if exists; else most recent)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setBanner(null);

      try {
        const { data: gws, error: gwErr } = await supabase.from('gameweeks').select('gameweek_id,name,start_ts,end_ts').order('start_ts', { ascending: true });

        if (gwErr) throw new Error(gwErr.message);

        const rows = ((gws as any) ?? []) as GameweekRow[];
        setGameweeks(rows);

        if (rows.length === 0) {
          setGwIdx(0);
          setCompetitions([]);
          setSubs([]);
          setLoading(false);
          return;
        }

        // Find live GW index
        const now = new Date();
        const liveIndex = rows.findIndex((r) => new Date(r.start_ts) <= now && new Date(r.end_ts) >= now);

        // Default: live if exists, else last
        setGwIdx(liveIndex >= 0 ? liveIndex : rows.length - 1);
      } catch (e: any) {
        setBanner({ kind: 'error', msg: e?.message ?? 'Failed to load gameweeks.' });
        setGameweeks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const gw = gameweeks[gwIdx] ?? null;

  // Load competitions + submissions for selected GW
  useEffect(() => {
    if (!gw) return;

    (async () => {
      setLoading(true);
      setBanner(null);

      try {
        // 1) Competitions for GW (these rows include competition_instance_id)
        const { data: cRows, error: cErr } = await supabase
          .from('v_competitions_ui')
          .select(
            `
            competition_id,
            gameweek_id,
            template_id,
            competition_name,
            competition_description,
            template_key,
            template_name,
            template_description,
            only_format,
            competition_instance_id
          `
          )
          .eq('gameweek_id', gw.gameweek_id)
          .order('competition_name', { ascending: true });

        if (cErr) throw new Error(cErr.message);

        const comps = ((cRows as any) ?? []) as CompetitionUiRow[];
        setCompetitions(comps);

        // 2) Submissions for GW (THIS fixes your count bug)
        const { data: sRows, error: sErr } = await supabase
          .from('team_submissions')
          .select('submission_id,user_id,competition_id,gameweek_id,template_id,created_at')
          .eq('gameweek_id', gw.gameweek_id);

        if (sErr) throw new Error(sErr.message);

        setSubs((((sRows as any) ?? []) as SubmissionRow[]) ?? []);
      } catch (e: any) {
        setCompetitions([]);
        setSubs([]);
        setBanner({ kind: 'error', msg: e?.message ?? 'Failed to load competitions.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [gw?.gameweek_id]);

  // Aggregate counts by (competition_id, template_id)
  const countsByKey = useMemo(() => {
    const m = new Map<string, { total: number; mine: number }>();
    for (const s of subs) {
      const key = `${s.competition_id}|${s.template_id ?? 'null'}`;
      const cur = m.get(key) ?? { total: 0, mine: 0 };
      cur.total += 1;
      if (userId && s.user_id === userId) cur.mine += 1;
      m.set(key, cur);
    }
    return m;
  }, [subs, userId]);

  function keyForCompRow(c: CompetitionUiRow) {
    return `${c.competition_id}|${c.template_id ?? 'null'}`;
  }

  function goPrev() {
    if (gameweeks.length === 0) return;
    setGwIdx((i) => (i - 1 + gameweeks.length) % gameweeks.length);
  }

  function goNext() {
    if (gameweeks.length === 0) return;
    setGwIdx((i) => (i + 1) % gameweeks.length);
  }

  // EXACT CHANGE: fetch display names from public.v_user_profiles
  async function fetchUserDisplays(userIds: string[]) {
    const uniq = Array.from(new Set(userIds.filter(Boolean)));
    if (uniq.length === 0) return new Map<string, UserDisplayRow>();

    const { data, error } = await supabase
      .from('v_user_profiles')
      .select('user_id,display_name,avatar_path')
      .in('user_id', uniq as any);

    if (error) return new Map<string, UserDisplayRow>();

    const m = new Map<string, UserDisplayRow>();
    for (const r of (((data as any) ?? []) as any[])) {
      const uid = String(r.user_id ?? '');
      const dn = String(r.display_name ?? '');
      if (uid && dn) m.set(uid, { user_id: uid, display_name: dn, image: (r.avatar_path ?? null) as any });
    }
    return m;
  }

  // Leaderboard modal loader
  useEffect(() => {
    if (!lbOpen || !activeCiId) return;

    (async () => {
      setLbLoading(true);
      setBanner(null);

      const { data, error } = await supabase
        .from('v_competition_instance_leaderboard')
        .select('competition_instance_id,rank,submission_id,user_id,final_points,submitted_at')
        .eq('competition_instance_id', activeCiId)
        .order('rank', { ascending: true });

      if (error) {
        setLbRows([]);
        setUserDisplayById(new Map());
        setBanner({ kind: 'error', msg: `Failed to load leaderboard: ${error.message}` });
      } else {
        const rows = (((data as any) ?? []) as LeaderboardRow[]).filter((r) => Number.isFinite(Number(r.rank)));
        setLbRows(rows);

        const ids = rows.map((r) => r.user_id).filter(Boolean);
        const m = await fetchUserDisplays(ids);
        setUserDisplayById(m);
      }

      setLbLoading(false);
    })();
  }, [lbOpen, activeCiId]);

  // Prize pool modal loader
  useEffect(() => {
    if (!prizeOpen || !activeCiId) return;

    (async () => {
      setPrizeLoading(true);
      setBanner(null);

      const { data, error } = await supabase
        .from('v_competition_instance_prize_pool')
        .select(
          `
          competition_instance_id,
          prize_rule_id,
          rule_kind,
          rank_from,
          rank_to,
          percentile,
          priority,
          label,
          prize_item_id,
          prize_type,
          qty,
          cp_amount,
          pack_template_id,
          card_player_id
        `
        )
        .eq('competition_instance_id', activeCiId)
        .order('priority', { ascending: true })
        .order('prize_item_id', { ascending: true });

      if (error) {
        setPrizeRows([]);
        setBanner({ kind: 'error', msg: `Failed to load prize pool: ${error.message}` });
      } else {
        setPrizeRows((((data as any) ?? []) as PrizePoolStaticRow[]) ?? []);
      }

      setPrizeLoading(false);
    })();
  }, [prizeOpen, activeCiId]);

  const medalIcon = (rankStart: number | null) => {
    if (rankStart === 1) return 'https://fantasy-cricket-assets.vercel.app/assets/gold.png';
    if (rankStart === 2) return 'https://fantasy-cricket-assets.vercel.app/assets/silver.png';
    if (rankStart === 3) return 'https://fantasy-cricket-assets.vercel.app/assets/bronze.png';
    return null;
  };

  const cpIconUrl = 'https://fantasy-cricket-assets.vercel.app/assets/cp.png';
  const iconStyle: React.CSSProperties = { width: 16, height: 16, objectFit: 'contain', display: 'block' };

  // Build a simple grouped prize view (rank label + item strings)
  const groupedPrize = useMemo(() => {
    const byRule = new Map<number, PrizePoolStaticRow[]>();
    for (const r of prizeRows) {
      const rid = Number(r.prize_rule_id);
      if (!Number.isFinite(rid)) continue;
      byRule.set(rid, [...(byRule.get(rid) ?? []), r]);
    }

    const rules = Array.from(byRule.entries())
      .map(([rid, items]) => {
        const first = items[0];
        const rankFrom = first.rank_from ?? null;
        const rankTo = first.rank_to ?? null;
        const priority = Number.isFinite(Number(first.priority)) ? Number(first.priority) : 999999;
        const label = first.label ?? '—';

        const rankLabel =
          rankFrom != null && rankTo != null ? (rankFrom === rankTo ? String(rankFrom) : `${rankFrom}–${rankTo}`) : label;

        const parts = items.map((it) => {
          const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1;
          const t = String(it.prize_type ?? '').toUpperCase();
          if (t === 'CP') {
            const cp = toNum(it.cp_amount) ?? 0;
            return { kind: 'CP' as const, text: `${cp * qty} CP` };
          }
          if (t === 'PACK') return { kind: 'TEXT' as const, text: `${qty} Pack` };
          if (t === 'CARD') return { kind: 'TEXT' as const, text: `${qty} Card` };
          if (t === 'NONE') return { kind: 'TEXT' as const, text: `No prize` };
          return { kind: 'TEXT' as const, text: `${qty} ${t}` };
        });

        return { rid, rankFrom, priority, rankLabel, parts };
      })
      .sort((a, b) => (a.rankFrom ?? 999999) - (b.rankFrom ?? 999999) || a.priority - b.priority);

    return rules;
  }, [prizeRows]);

  // NEW: can click submission IDs only if competition start date is in the past
  const canClickSubmission = useMemo(() => {
    if (!gw?.start_ts) return false;
    return new Date(gw.start_ts).getTime() < Date.now();
  }, [gw?.start_ts]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Competitions</h1>
          <p style={{ marginTop: 6, color: '#555' }}>Browse competitions by gameweek.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/play/live"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e5e5',
              textDecoration: 'none',
              color: '#111',
              fontWeight: 800,
              background: '#fff',
            }}
          >
            Go to Live
          </Link>

          <button
            onClick={() => {
              // quick reload by re-setting index (triggers effect)
              setGwIdx((x) => x);
            }}
            disabled={loading}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div
          style={{
            marginTop: 12,
            background: bannerColor(banner.kind),
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
          }}
        >
          {banner.msg}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading…</div>
      ) : gameweeks.length === 0 ? (
        <div style={{ marginTop: 18 }}>No gameweeks found.</div>
      ) : !gw ? (
        <div style={{ marginTop: 18 }}>No selected gameweek.</div>
      ) : (
        <>
          {/* GW header */}
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Gameweek</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <button
                    onClick={goPrev}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: '1px solid #e5e5e5',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 900,
                      fontSize: 18,
                      lineHeight: '32px',
                    }}
                    aria-label="Previous gameweek"
                  >
                    ‹
                  </button>

                  <div style={{ fontSize: 18, fontWeight: 900 }}>{gw.name}</div>

                  <button
                    onClick={goNext}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: '1px solid #e5e5e5',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 900,
                      fontSize: 18,
                      lineHeight: '32px',
                    }}
                    aria-label="Next gameweek"
                  >
                    ›
                  </button>
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 4, fontSize: 12, color: '#666' }}>
                  <div>
                    <b style={{ color: '#111' }}>Start:</b> {new Date(gw.start_ts).toLocaleString()}
                  </div>
                  <div>
                    <b style={{ color: '#111' }}>End:</b> {new Date(gw.end_ts).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#666' }}>Competitions</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{competitions.length}</div>
              </div>
            </div>
          </div>

          {/* competitions list */}
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            {competitions.length === 0 ? (
              <div style={{ color: '#666' }}>No competitions for this gameweek.</div>
            ) : (
              competitions.map((c, idx) => {
                const desc = c.competition_description ?? c.template_description ?? '—';
                const fmt = c.only_format ?? 'Any';

                const key = keyForCompRow(c);
                const counts = countsByKey.get(key) ?? { total: 0, mine: 0 };

                const canOpenModal = Number.isFinite(Number(c.competition_instance_id)) && c.competition_instance_id !== null;

                return (
                  <div
                    key={`${c.competition_id}-${c.template_id}-${idx}`}
                    style={{
                      border: '1px solid #e5e5e5',
                      borderRadius: 14,
                      background: '#fff',
                      padding: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 18, fontWeight: 950 }}>{c.competition_name}</div>

                      {/* Optional: link to instance page (handy for debugging) */}
                      {canOpenModal ? (
                        <Link href={`/play/competitions/${c.competition_instance_id}`} style={{ fontSize: 12, fontWeight: 900, color: '#111', textDecoration: 'none' }}>
                          Open page →
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: '#777', fontWeight: 800 }}>Not started</span>
                      )}
                    </div>

                    <div style={{ marginTop: 6, color: '#555' }}>{desc}</div>

                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <div style={{ color: '#666', fontSize: 12 }}>Format</div>
                        <div style={{ fontWeight: 900 }}>{fmt}</div>
                      </div>
                      <div>
                        <div style={{ color: '#666', fontSize: 12 }}>Start</div>
                        <div style={{ fontWeight: 900 }}>{new Date(gw.start_ts).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: '#666', fontSize: 12 }}>End</div>
                        <div style={{ fontWeight: 900 }}>{new Date(gw.end_ts).toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          if (!c.competition_instance_id) return;
                          setActiveCiId(c.competition_instance_id);
                          setPrizeOpen(true);
                        }}
                        disabled={!canOpenModal}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #111',
                          background: canOpenModal ? '#111' : '#eee',
                          color: canOpenModal ? '#fff' : '#777',
                          fontWeight: 900,
                          cursor: canOpenModal ? 'pointer' : 'not-allowed',
                        }}
                      >
                        View Prize Pool
                      </button>

                      <button
                        onClick={() => {
                          if (!c.competition_instance_id) return;
                          setActiveCiId(c.competition_instance_id);
                          setLbOpen(true);
                        }}
                        disabled={!canOpenModal}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid #e5e5e5',
                          background: canOpenModal ? '#fff' : '#f3f4f6',
                          color: canOpenModal ? '#111' : '#777',
                          fontWeight: 900,
                          cursor: canOpenModal ? 'pointer' : 'not-allowed',
                        }}
                      >
                        View Leaderboard
                      </button>
                    </div>

                    <div style={{ marginTop: 12, color: '#555', fontSize: 13 }}>
                      <div>
                        <b style={{ color: '#111' }}>{counts.total}</b> total teams submitted.
                      </div>
                      <div>
                        You submitted <b style={{ color: '#111' }}>{counts.mine}</b> teams.
                      </div>
                    </div>

                    {/* Divider between comps */}
                    <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6' }} />
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Prize Pool Modal */}
      <Modal title="Prize Pool" open={prizeOpen} onClose={() => setPrizeOpen(false)} maxWidth={900}>
        {!activeCiId ? (
          <div style={{ color: '#555' }}>No competition instance selected.</div>
        ) : prizeLoading ? (
          <div style={{ color: '#555' }}>Loading prize pool…</div>
        ) : groupedPrize.length === 0 ? (
          <div style={{ color: '#555' }}>No prize pool rows yet.</div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Rank</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Prize</th>
                </tr>
              </thead>
              <tbody>
                {groupedPrize.map((r) => {
                  const medal = medalIcon(r.rankFrom ?? null);
                  return (
                    <tr key={r.rid}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {medal ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={medal} alt="" style={iconStyle} />
                          ) : null}
                          <span>{r.rankLabel}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          {r.parts.map((p, i) => {
                            if (p.kind === 'CP') {
                              return (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 900 }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={cpIconUrl} alt="CP" style={iconStyle} />
                                  {p.text}
                                </span>
                              );
                            }
                            return (
                              <span key={i} style={{ fontWeight: 800 }}>
                                {p.text}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 10, fontSize: 12, color: '#777' }}>(If you want pack names + player names here like your instance page, we can reuse the same resolver logic.)</div>
          </div>
        )}
      </Modal>

      {/* Leaderboard Modal */}
      <Modal title="Live Leaderboard" open={lbOpen} onClose={() => setLbOpen(false)} maxWidth={900}>
        {!activeCiId ? (
          <div style={{ color: '#555' }}>No competition instance selected.</div>
        ) : lbLoading ? (
          <div style={{ color: '#555' }}>Loading leaderboard…</div>
        ) : lbRows.length === 0 ? (
          <div style={{ color: '#555' }}>No leaderboard rows yet.</div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Rank</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>User</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Submission #</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Points</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {lbRows.map((r) => {
                  const isMe = userId ? r.user_id === userId : false;

                  const disp = userDisplayById.get(r.user_id)?.display_name ?? null;
                  const userHref = disp ? `/profile/${encodeURIComponent(disp)}` : null;

                  return (
                    <tr key={`${r.submission_id}-${r.rank}`} style={{ background: isMe ? '#f5f3ff' : '#fff' }}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900 }}>{r.rank}</td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {userHref ? (
                          <Link href={userHref} style={{ color: '#111', textDecoration: 'none', fontWeight: isMe ? 900 : 800 }}>
                            {disp}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: isMe ? 900 : 700 }}>{shortId(r.user_id)}</span>
                        )}
                        {isMe ? <span style={{ marginLeft: 8, fontSize: 12, color: '#6d28d9', fontWeight: 900 }}>(You)</span> : null}
                      </td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {canClickSubmission ? (
                          <Link href={`/play/${r.submission_id}`} style={{ color: '#111', fontWeight: 900, textDecoration: 'none' }}>
                            {r.submission_id}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 900 }}>{r.submission_id}</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900 }}>{fmtPts(r.final_points)}</td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
