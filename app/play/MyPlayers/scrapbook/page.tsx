'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type TeamRow = {
  team_id: number;
  team_name: string;
};

type ScrapbookRow = {
  team_id: number;
  team_name: string;

  player_id: number;
  full_name: string;
  role: string | null;
  country_id: number | null;
  image: string | null;

  // does current user own ANY active (non-burned) current card for this player?
  is_owned: boolean;

  // optional (nice-to-have if your view provides it later)
  owned_card_count?: number | null;

  // present in your view extract
  active?: boolean | null;
};

type MyCardLiteRow = {
  player_id: number;
  is_active: boolean;
};

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
}

function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

export default function ScrapbookPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const [rows, setRows] = useState<ScrapbookRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  // player_id -> count of ACTIVE cards the user owns
  const [activeOwnedCountByPlayerId, setActiveOwnedCountByPlayerId] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // Load teams for dropdown
  useEffect(() => {
    (async () => {
      setLoadingTeams(true);
      setBanner(null);

      // NOTE: expects public.v_scrapbook_teams
      const { data, error } = await supabase
        .from('v_scrapbook_teams')
        .select('team_id,team_name')
        .order('team_name', { ascending: true });

      if (error) {
        setBanner({ kind: 'error', msg: `Failed to load teams: ${error.message}` });
        setTeams([]);
        setSelectedTeamId(null);
      } else {
        const t = ((data as any) ?? []) as TeamRow[];
        setTeams(t);
        setSelectedTeamId(t.length ? t[0].team_id : null);
      }

      setLoadingTeams(false);
    })();
  }, []);

  // Load active-owned counts (X Owned) from v_my_player_cards using is_active only
  useEffect(() => {
    if (!userId) {
      setActiveOwnedCountByPlayerId({});
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('v_my_player_cards')
        .select('player_id,is_active')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        // keep UI working even if this fails
        setActiveOwnedCountByPlayerId({});
        return;
      }

      const map: Record<number, number> = {};
      for (const r of ((data as any) ?? []) as MyCardLiteRow[]) {
        const pid = Number((r as any).player_id);
        if (!Number.isFinite(pid)) continue;
        map[pid] = (map[pid] ?? 0) + 1;
      }
      setActiveOwnedCountByPlayerId(map);
    })();
  }, [userId]);

  // Load scrapbook rows once a team is selected
  useEffect(() => {
    if (!userId || !selectedTeamId) {
      setRows([]);
      return;
    }

    (async () => {
      setLoadingRows(true);
      setBanner(null);

      // NOTE: expects public.v_team_scrapbook_players view with columns incl:
      // user_id, team_id, team_name, player_id, full_name, role, country_id, image, is_owned
      const { data, error } = await supabase
        .from('v_team_scrapbook_players')
        .select('team_id,team_name,player_id,full_name,role,country_id,image,is_owned')
        .eq('team_id', selectedTeamId)
        .eq('user_id', userId)
        .order('full_name', { ascending: true });

      if (error) {
        setBanner({ kind: 'error', msg: `Failed to load scrapbook: ${error.message}` });
        setRows([]);
      } else {
        setRows(((data as any) ?? []) as ScrapbookRow[]);
      }

      setLoadingRows(false);
    })();
  }, [userId, selectedTeamId]);

  const filtered = useMemo(() => rows, [rows]);

  // unique owned players / total players counter (e.g., 5/14)
  const ownedUniqueCount = useMemo(() => {
    return filtered.filter((p) => (activeOwnedCountByPlayerId[p.player_id] ?? 0) > 0).length;
  }, [filtered, activeOwnedCountByPlayerId]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <h1 style={{ margin: 0 }}>Scrapbook</h1>
      <p style={{ marginTop: 6, color: '#555' }}>
        View all players who represented a team — the ones you don’t own are greyed out.
      </p>

      {!userId ? (
        <div style={{ marginTop: 14, padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff' }}>
          Please sign in to view your scrapbook.
        </div>
      ) : (
        <>
          {banner && (
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

          <div
            style={{
              marginTop: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
              padding: 14,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                minWidth: 260,
                textAlign: 'center',
                position: 'relative',
                width: '100%',
              }}
            >
              <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>Select Scrapbook</div>

              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#111',
                }}
              >
                {ownedUniqueCount} / {filtered.length}
              </div>

              {loadingTeams ? (
                <div style={{ marginTop: 6, textAlign: 'center' }}>Loading teams…</div>
              ) : teams.length === 0 ? (
                <div style={{ marginTop: 6, textAlign: 'center' }}>No teams available.</div>
              ) : (
                <select
                  value={selectedTeamId ?? ''}
                  onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                  style={{
                    marginTop: 6,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #e5e5e5',
                    background: '#fff',
                    fontWeight: 800,
                    outline: 'none',
                    textAlign: 'center',
                    textAlignLast: 'center',
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {loadingRows ? (
              <div style={{ marginTop: 10 }}>Loading scrapbook…</div>
            ) : !selectedTeamId ? (
              <div style={{ marginTop: 10 }}>Select a team to view its scrapbook.</div>
            ) : filtered.length === 0 ? (
              <div style={{ marginTop: 10 }}>No players found for this team.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Showing <b>{filtered.length}</b> players
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: 12,
                  }}
                >
                  {filtered.map((p) => {
                    const playerImg = assetUrl(p.image);
                    const ownedCount = activeOwnedCountByPlayerId[p.player_id] ?? 0;

                    return (
                      <div
                        key={p.player_id}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #e5e5e5',
                          background: '#fff',
                          padding: 12,
                          opacity: p.is_owned ? 1 : 0.35,
                          filter: p.is_owned ? 'none' : 'grayscale(1)',
                          transition: 'opacity 0.15s ease',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                        }}
                        title={p.is_owned ? `${ownedCount} Owned` : 'Not owned'}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            background: '#111',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto',
                            overflow: 'hidden',
                          }}
                        >
                          {playerImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={playerImg}
                              alt={p.full_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <span style={{ fontSize: 11, opacity: 0.9 }}>IMG</span>
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 950,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {p.full_name}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{p.role ?? '—'}</div>

                          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: 12,
                                padding: '4px 10px',
                                borderRadius: 999,
                                border: '1px solid #eee',
                                background: p.is_owned ? '#dcfce7' : '#f3f4f6',
                                fontWeight: 900,
                              }}
                            >
                              {p.is_owned ? `${ownedCount} Owned` : 'Not owned'}
                            </span>

                            <button
                              onClick={() => {
                                window.location.href = `/players/${p.player_id}`;
                              }}
                              style={{
                                fontSize: 12,
                                padding: '6px 10px',
                                borderRadius: 10,
                                border: '1px solid #e5e5e5',
                                background: '#fff',
                                cursor: 'pointer',
                                fontWeight: 900,
                              }}
                            >
                              View player
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
