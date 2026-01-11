'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CardDetailsModal from '../../cards/CardDetailsModal';

type MyCardRow = {
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
  points_earned: number;
  matches_selected: number;

  owners_count?: number | null;

  full_name: string;
  role: string | null;
  country_id: number | null;
  image: string | null;
  player_active: boolean | null;

  last_match_points?: number | null;
};

type TeamLookupRow = {
  team_id: number;
  short_name: string | null;
  name: string | null;
  logo: string | null;
};

type OverallPointScoreRow = Record<string, any>;

function safeLower(v: any) {
  return String(v ?? '').toLowerCase();
}

function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
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

function ToggleSwitch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string }) {
  const { checked, onChange, label, sublabel } = props;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>{label}</div>
        {sublabel ? <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>{sublabel}</div> : null}
      </div>

      <button
        type="button"
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.18)',
          background: checked ? '#0ea5a4' : 'rgba(255,255,255,0.18)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
          flex: '0 0 auto',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 24 : 3,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#fff',
            transition: 'left 140ms ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        />
      </button>
    </div>
  );
}

export default function MyPlayersPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<MyCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [countrySearch, setCountrySearch] = useState('');
  const [showBurned, setShowBurned] = useState(false);

  // Avg / Last match flip (main page only)
  const [showAverages, setShowAverages] = useState(false);

  // modal selection
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // country/team lookup map (country_id -> {short_name/name/logo})
  const [teamById, setTeamById] = useState<Record<number, TeamLookupRow>>({});

  // overall point scores (for last match + averages + lifetime totals by player_id)
  const [overallScores, setOverallScores] = useState<OverallPointScoreRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      setBanner(null);

      const { data, error } = await supabase
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
          owners_count,
          full_name,
          role,
          country_id,
          image,
          player_active
        `
        )
        .eq('user_id', userId)
        .order('acquired_on', { ascending: false });

      if (error) {
        setBanner({ kind: 'error', msg: `Failed to load your cards: ${error.message}` });
        setRows([]);
        setTeamById({});
        setOverallScores([]);
        setLoading(false);
        return;
      }

      const nextRows = (((data as any) ?? []) as MyCardRow[]) ?? [];
      setRows(nextRows);

      // --- Team lookup fetch: public.teams (view) ---
      const ids = Array.from(new Set(nextRows.map((r) => r.country_id).filter((x): x is number => typeof x === 'number')));

      if (ids.length > 0) {
        const { data: tdata, error: terr } = await supabase.from('teams').select('team_id, short_name, name, logo').in('team_id', ids);

        if (!terr) {
          const map: Record<number, TeamLookupRow> = {};
          for (const tr of (tdata as any[]) ?? []) {
            if (typeof tr.team_id === 'number') map[tr.team_id] = tr as TeamLookupRow;
          }
          setTeamById(map);
        } else {
          setTeamById({});
        }
      } else {
        setTeamById({});
      }

      // --- Overall point scores (public view with spaced/cased columns) ---
      const { data: scores, error: scoreErr } = await supabase.from('v_player_overall_point_scores').select('*');
      if (scoreErr) {
        console.error('Failed to load v_player_overall_point_scores:', scoreErr.message);
        setOverallScores([]);
      } else {
        setOverallScores(((scores as any) ?? []) as OverallPointScoreRow[]);
      }

      setLoading(false);
    })();
  }, [userId]);

  const roleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.role) s.add(r.role);
    }
    return ['All', ...Array.from(s).sort()];
  }, [rows]);

  const scoreByPlayerId = useMemo(() => {
    const m = new Map<number, OverallPointScoreRow>();
    for (const r of overallScores) {
      const pid = Number(r['Player ID']);
      if (Number.isFinite(pid) && !m.has(pid)) m.set(pid, r);
    }
    return m;
  }, [overallScores]);

  function pointsDisplayForPlayer(playerId: number | null | undefined, mode: 'avg' | 'last') {
    const base = {
      label: mode === 'avg' ? 'Avg pts / game:' : 'Last match pts:',
      value: '—',
      title: '',
    };

    if (!playerId) return base;

    const r = scoreByPlayerId.get(Number(playerId));
    if (!r) return base;

    if (mode === 'avg') {
      const title = `Bat: ${fmtPts(r['Average Batting Points per game'])} | Bowl: ${fmtPts(
        r['Average Bowling Points per game']
      )} | Field: ${fmtPts(r['Average Fielding Points per game'])} | Misc: ${fmtPts(r['Average Misc. points per game'])}`;
      return {
        label: 'Avg pts / game:',
        value: fmtPts(r['Average points per game']),
        title,
      };
    }

    const title = `Bat: ${fmtPts(r['Batting points in last game'])} | Bowl: ${fmtPts(r['Bowling points in last game'])} | Field: ${fmtPts(
      r['Fielding points in last game']
    )} | Misc: ${fmtPts(r['Misc points last game'])}`;
    return {
      label: 'Last match pts:',
      value: fmtPts(r['Points in last game']),
      title,
    };
  }

  const filtered = useMemo(() => {
    const s = safeLower(search.trim());
    const c = safeLower(countrySearch.trim());

    return rows.filter((r) => {
      const isBurned = !!r.burned_on || r.is_active === false;
      if (!showBurned && isBurned) return false;

      if (activeOnly) {
        if (r.player_active === false) return false;
        if (isBurned) return false;
      }

      if (roleFilter !== 'All' && (r.role ?? '') !== roleFilter) return false;

      if (c) {
        const team = r.country_id ? teamById[r.country_id] : undefined;
        const teamName = safeLower(team?.short_name);
        const teamFull = safeLower(team?.name);
        if (!teamName.includes(c) && !teamFull.includes(c)) return false;
      }

      if (s) {
        const nm = safeLower(r.full_name);
        if (!nm.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, countrySearch, roleFilter, activeOnly, showBurned, teamById]);

  const selected = useMemo(() => {
    if (!selectedCardId) return null;
    return rows.find((r) => r.card_id === selectedCardId) ?? null;
  }, [rows, selectedCardId]);

  function openModalFor(cardId: number) {
    setSelectedCardId(cardId);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <h1 style={{ margin: 0 }}>My Players</h1>
      <p style={{ marginTop: 6, color: '#555' }}>Your owned player cards.</p>

      {banner && (
        <div
          style={{
            marginTop: 12,
            background: banner.kind === 'error' ? '#fee2e2' : '#d1fae5',
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
          }}
        >
          {banner.msg}
        </div>
      )}

      {!userId ? (
        <div style={{ marginTop: 18, padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff' }}>
          Please sign in to view your players.
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: 14,
            alignItems: 'start',
          }}
        >
          {/* LEFT: Filter panel ONLY */}
          <div
            style={{
              borderRadius: 16,
              background: '#0b0b0b',
              color: '#fff',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Filters</div>

              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player name…"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />

                <ToggleSwitch checked={activeOnly} onChange={setActiveOnly} label="Active players only" />
                <ToggleSwitch checked={showBurned} onChange={setShowBurned} label="Show Burned Cards" />

                <ToggleSwitch
                  checked={showAverages}
                  onChange={setShowAverages}
                  label={showAverages ? 'Show Point Averages' : 'Show Last Match'}
                  sublabel={showAverages ? 'Showing average points per game' : 'Showing points in last match'}
                />

                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Role</div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r} style={{ color: '#111' }}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Country</div>
                  <input
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Type a country."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                Showing <b>{filtered.length}</b> cards
              </div>
            </div>
          </div>

          {/* RIGHT: Card grid (click opens modal) */}
          <div
            style={{
              borderRadius: 16,
              background: '#fff',
              border: '1px solid #e5e5e5',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
              minHeight: 640,
            }}
          >
            <div style={{ padding: 14 }}>
              {loading ? (
                <div style={{ opacity: 0.9 }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ opacity: 0.9 }}>No cards match your filters.</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 12,
                  }}
                >
                  {filtered.map((r) => {
                    const isBurned = !!r.burned_on || r.is_active === false;
                    const team = r.country_id ? teamById[r.country_id] : undefined;
                    const flagUrl = assetUrl(team?.logo ?? null);
                    const playerImg = assetUrl(r.image ?? null);

                    const p = pointsDisplayForPlayer(r.player_id ?? null, showAverages ? 'avg' : 'last');

                    return (
                      <button
                        key={r.card_id}
                        onClick={() => openModalFor(r.card_id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 14,
                          border: '1px solid #e5e5e5',
                          background: '#fff',
                          padding: 10,
                          cursor: 'pointer',
                          opacity: isBurned ? 0.6 : 1,
                          display: 'grid',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            borderRadius: 12,
                            background: '#111',
                            border: '1px solid rgba(0,0,0,0.10)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {playerImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={playerImg}
                              alt={r.full_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{ color: '#fff', fontSize: 12, opacity: 0.8 }}>IMG</div>
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.full_name}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{r.role ?? '—'}</div>

                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                overflow: 'hidden',
                                border: '1px solid rgba(0,0,0,0.10)',
                                background: '#f3f4f6',
                                flex: '0 0 auto',
                              }}
                            >
                              {flagUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={flagUrl}
                                  alt={team?.short_name ?? 'Nation'}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : null}
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.85, minWidth: 0 }} title={p.title}>
                              {p.label} <b>{p.value}</b>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL now lives in app/cards */}
      <CardDetailsModal open={isModalOpen} onClose={closeModal} selected={selected} teamById={teamById} overallScores={overallScores} />
    </div>
  );
}
