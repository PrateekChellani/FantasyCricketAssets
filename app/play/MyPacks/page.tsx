'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';

type PackTemplate = {
  pack_template_id: number;
  template_key: string;
  name: string;
  description: string | null;
  kind: 'Pack' | 'Pick' | string;
  reveal_count: number;
  pick_count: number;
  cp_cost: number | null;
  player_filter: any | null;
  tier_weights: any | null;
  is_active: boolean;
  created_at: string;

  // optional (if you later add it to pack_templates wrapper)
  pack_image?: string | null;
};

type PackInstance = {
  pack_instance_id: number;
  pack_template_id: number;
  user_id: string;
  status: string;
  purchased_at: string | null;
  opened_at: string | null;
  claimed_at: string | null;
  created_at: string;
  template?: PackTemplate | null;
};

type RevealRow = {
  pack_instance_id: number;
  reveal_index: number;
  player_id: number;
  card_id: number | null;
  revealed_at: string;

  player_full_name: string;
  role: string | null;
  tier: string | null;
  country_id: number | null;
  player_image: string | null;

  card_type: string | null;
  edition: string | null;
  minted_on: string | null;
};

type PickProgressRow = {
  pack_instance_id: number;
  kind: string | null;
  pick_count: number;
  picks_made: number;
};

// country lookup comes from teams (teams.team_id = players.country_id)
type TeamRow = {
  team_id: number;
  name: string | null;
  logo: string | null;
};

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
}

function fmtWhen(ts: string | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

function normAssetPath(p?: string | null) {
  if (!p) return null;
  return p.startsWith('/') ? p.slice(1) : p;
}

function packImgUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

export default function MyPacksPage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<PackInstance[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const [confirmOpen, setConfirmOpen] = useState<PackInstance | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Opened modal state
  const [openModal, setOpenModal] = useState(false);
  const [openedPack, setOpenedPack] = useState<PackInstance | null>(null);
  const [reveals, setReveals] = useState<RevealRow[]>([]);
  const [idx, setIdx] = useState(0);

  // pick state (only meaningful for Pick packs)
  const [pickProgress, setPickProgress] = useState<PickProgressRow | null>(null);
  const [picking, setPicking] = useState(false);

  // country/team map
  const [countryTeamMap, setCountryTeamMap] = useState<Record<number, TeamRow>>({});

  async function loadCountryTeams() {
    const { data, error } = await supabase.from('teams').select('team_id,name,logo');
    if (error) {
      console.warn('[MyPacks] Failed to load teams for country mapping:', error.message);
      setCountryTeamMap({});
      return;
    }

    const rows = ((data as any) ?? []) as TeamRow[];
    const map: Record<number, TeamRow> = {};
    for (const r of rows) {
      if (typeof r.team_id === 'number') map[r.team_id] = r;
    }
    setCountryTeamMap(map);
  }

  async function loadAll(uid: string) {
    setLoading(true);
    setBanner(null);

    // Only show unopened/unclaimed: Purchased only
    const { data, error } = await supabase
      .from('pack_instances')
      .select(
        `
        pack_instance_id,
        pack_template_id,
        user_id,
        status,
        purchased_at,
        opened_at,
        claimed_at,
        created_at,
        template:pack_templates (
          pack_template_id,
          template_key,
          name,
          description,
          kind,
          reveal_count,
          pick_count,
          cp_cost,
          pack_image,
          player_filter,
          tier_weights,
          is_active,
          created_at
        )
      `
      )
      .eq('user_id', uid)
      .eq('status', 'Purchased')
      .is('opened_at', null)
      .is('claimed_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      setBanner({ kind: 'error', msg: `Failed to load packs: ${error.message}` });
      setPacks([]);
    } else {
      setPacks((data as any) ?? []);
    }

    setLoading(false);
  }

  async function loadReveals(packInstanceId: number) {
    const { data, error } = await supabase
      .from('v_pack_instance_reveals')
      .select(
        `
        pack_instance_id,
        reveal_index,
        player_id,
        card_id,
        revealed_at,
        player_full_name,
        role,
        tier,
        country_id,
        player_image,
        card_type,
        edition,
        minted_on
      `
      )
      .eq('pack_instance_id', packInstanceId)
      .order('reveal_index', { ascending: true });

    if (error) throw new Error(`Failed to load pack contents: ${error.message}`);

    const rows = ((data as any) ?? []) as RevealRow[];
    setReveals(rows);
    setIdx(0);
  }

  async function loadPickProgress(packInstanceId: number) {
    const { data, error } = await supabase
      .from('v_pack_pick_progress')
      .select('pack_instance_id, kind, pick_count, picks_made')
      .eq('pack_instance_id', packInstanceId)
      .limit(1);

    if (error) throw new Error(`Failed to load pick progress: ${error.message}`);

    const row = ((data as any) ?? [])[0] as PickProgressRow | undefined;
    setPickProgress(row ?? null);
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (error) setBanner({ kind: 'error', msg: `Auth error: ${error.message}` });

      setUserId(uid);

      await loadCountryTeams();

      if (uid) await loadAll(uid);
      else setLoading(false);
    })();
  }, []);

  const openable = useMemo(() => packs, [packs]);

  async function doOpenPack(p: PackInstance) {
    if (!userId) {
      setBanner({ kind: 'error', msg: 'Please sign in.' });
      return;
    }

    try {
      setBusyId(p.pack_instance_id);
      setBanner(null);

      const { error } = await supabase.rpc('open_pack', {
        p_pack_instance_id: p.pack_instance_id,
        p_user_id: userId,
      });

      if (error) throw new Error(error.message);

      // Immediately show contents modal
      await loadReveals(p.pack_instance_id);

      // If it’s a Pick, also load progress
      const kind = (p.template?.kind ?? '').toLowerCase();
      if (kind === 'pick') {
        await loadPickProgress(p.pack_instance_id);
      } else {
        setPickProgress(null);
      }

      setOpenedPack(p);
      setOpenModal(true);

      // Refresh list (opened pack should disappear)
      setConfirmOpen(null);
      await loadAll(userId);
    } catch (e: any) {
      setBanner({ kind: 'error', msg: e?.message ?? 'Failed to open pack.' });
    } finally {
      setBusyId(null);
    }
  }

  const current = reveals[idx] ?? null;
  const isPick = (openedPack?.template?.kind ?? '').toLowerCase() === 'pick';
  const picksRemaining = pickProgress ? Math.max(0, (pickProgress.pick_count ?? 0) - (pickProgress.picks_made ?? 0)) : null;

  const countryTeam = current?.country_id ? countryTeamMap[current.country_id] : undefined;
  const countryName = countryTeam?.name ?? (current?.country_id ? `Country ${current.country_id}` : '—');
  const countryLogo = countryTeam?.logo ? `https://fantasy-cricket-assets.vercel.app/${normAssetPath(countryTeam.logo)}` : null;

  async function pickThisPlayer() {
    if (!userId || !openedPack || !current) return;

    try {
      setPicking(true);
      setBanner(null);

      const { data, error } = await supabase.rpc('pick_pack_player', {
        p_user_id: userId,
        p_pack_instance_id: openedPack.pack_instance_id,
        p_reveal_index: current.reveal_index,
      });

      if (error) throw new Error(error.message);

      await loadPickProgress(openedPack.pack_instance_id);

      setBanner({ kind: 'success', msg: `Picked player ✅ (slot ${data})` });
    } catch (e: any) {
      setBanner({ kind: 'error', msg: e?.message ?? 'Failed to pick player.' });
    } finally {
      setPicking(false);
    }
  }

  function StatBox(props: { label: string; value: any }) {
    return (
      <div
        style={{
          flex: 1,
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '10px 10px',
          background: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, color: '#666', fontWeight: 900 }}>{props.label}</div>
        <div style={{ marginTop: 2, fontSize: 18, fontWeight: 950, color: '#111' }}>{String(props.value ?? '—')}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>My Packs</h1>
          <p style={{ marginTop: 6, color: '#555' }}>All unopened packs show here. Open a pack to reveal what’s inside.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/store"
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
            Go to Store
          </Link>

          <button
            onClick={() => userId && loadAll(userId)}
            disabled={!userId || loading}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontWeight: 800,
              cursor: !userId || loading ? 'not-allowed' : 'pointer',
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
      ) : !userId ? (
        <div style={{ marginTop: 18 }}>Please sign in to view your packs.</div>
      ) : openable.length === 0 ? (
        <div style={{ marginTop: 18 }}>You have no unopened packs.</div>
      ) : (
        <>
          <div style={{ marginTop: 14, color: '#666', fontSize: 13 }}>
            Unopened packs: <b>{openable.length}</b>
          </div>

          {/* 4-up responsive grid (matches Store) */}
          <style>{`
            .mypacks-grid{
              display:grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 16px;
              align-items: stretch;
              margin-top: 12px;
            }
            @media (max-width: 1100px){
              .mypacks-grid{ grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            @media (max-width: 820px){
              .mypacks-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 520px){
              .mypacks-grid{ grid-template-columns: 1fr; }
            }
          `}</style>

          <div className="mypacks-grid">
            {openable.map((p) => {
              const t = p.template;
              const kind = (t?.kind ?? '').toLowerCase();
              const isPickPack = kind === 'pick';
              const img = packImgUrl((t as any)?.pack_image ?? null); // optional if you later add pack_image to wrapper

              const revealsLabel = isPickPack ? 'Cards seen' : 'Cards you get';
              const picksLabel = 'Picks you get';

              return (
                <div
                  key={p.pack_instance_id}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 16,
                    background: '#fff',
                    overflow: 'hidden',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 320,
                  }}
                >
                  {/* Image header (optional) */}
                  <div
                    style={{
                      height: 120,
                      background: '#111',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={t?.name ?? `Pack #${p.pack_instance_id}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          display: 'block',
                          padding: 10,
                        }}
                      />
                    ) : (
                      <div style={{ color: '#fff', opacity: 0.8, fontWeight: 900 }}>{t?.name ?? 'Pack'}</div>
                    )}
                  </div>

                  <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 1000, textAlign: 'center', lineHeight: 1.15 }}>
                      {t?.name ?? `Pack #${p.pack_instance_id}`}
                    </div>

                    <div style={{ fontSize: 12, color: '#666', textAlign: 'center', minHeight: 34 }}>{t?.description ?? '—'}</div>

                    <div style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>
                      Status: <b style={{ color: '#111' }}>{p.status}</b>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>
                      Purchased: <b style={{ color: '#111' }}>{fmtWhen(p.purchased_at)}</b>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                      <StatBox label={revealsLabel} value={t?.reveal_count ?? '—'} />
                      {isPickPack ? <StatBox label={picksLabel} value={t?.pick_count ?? 0} /> : null}
                    </div>
                  </div>

                  <div style={{ padding: 12, paddingTop: 0, marginTop: 'auto' }}>
                    <button
                      onClick={() => setConfirmOpen(p)}
                      disabled={busyId !== null}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid #111',
                        background: '#111',
                        color: '#fff',
                        fontWeight: 1000,
                        cursor: busyId !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {busyId === p.pack_instance_id ? 'Opening…' : 'Open'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Confirm modal */}
      {confirmOpen && (
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
            if (e.target === e.currentTarget) setConfirmOpen(null);
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              border: '1px solid #e5e5e5',
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Open this pack?</div>
            <div style={{ marginTop: 8, color: '#555' }}>This action cannot be undone.</div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmOpen(null)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  color: '#111',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => doOpenPack(confirmOpen)}
                disabled={busyId !== null}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #111',
                  background: '#111',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: busyId !== null ? 'not-allowed' : 'pointer',
                }}
              >
                Yes, open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opened pack modal (carousel) — unchanged */}
      {openModal && openedPack && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(860px, 96vw)',
              background: '#0b1220',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            {/* header */}
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                color: '#fff',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {openedPack.template?.name ?? `Pack #${openedPack.pack_instance_id}`} — Opened
                </div>
                <div style={{ opacity: 0.8, fontSize: 12 }}>{reveals.length > 0 ? `Item ${idx + 1} / ${reveals.length}` : 'No items found'}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => setIdx((v) => Math.max(0, v - 1))}
                    style={{
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    ‹ Prev
                  </button>
                )}
                {idx < reveals.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setIdx((v) => Math.min(reveals.length - 1, v + 1))}
                    style={{
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    Next ›
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* body */}
            <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
              {!current ? (
                <div style={{ color: '#fff', opacity: 0.85 }}>No revealed items found for this pack.</div>
              ) : (
                <div style={{ width: 420 }}>
                  {/* Card */}
                  <div
                    style={{
                      borderRadius: 18,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                      border: '1px solid rgba(255,255,255,0.10)',
                      padding: 14,
                      color: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        style={{
                          background: '#fbbf24',
                          color: '#111',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {current.card_type ?? 'Standard'}
                      </div>

                      <div style={{ opacity: 0.85, fontWeight: 800, fontSize: 12 }}>#{current.card_id ?? '—'}</div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        borderRadius: 16,
                        height: 300,
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {current.player_image ? (
                        <img
                          src={`https://fantasy-cricket-assets.vercel.app/${normAssetPath(current.player_image)}`}
                          alt={current.player_full_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>No player image</div>
                      )}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 20, fontWeight: 1000, lineHeight: 1.1 }}>{current.player_full_name}</div>

                      <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: 0.92 }}>
                        <span style={{ fontSize: 13 }}>{current.role ?? '—'}</span>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span style={{ fontSize: 13, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                          {countryLogo ? (
                            <img
                              src={countryLogo}
                              alt=""
                              width={18}
                              height={18}
                              style={{ borderRadius: 999, display: 'block' }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <span>{countryName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pick controls */}
                  {isPick && pickProgress && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={pickThisPlayer}
                        disabled={picking || (picksRemaining !== null && picksRemaining <= 0)}
                        style={{
                          width: '100%',
                          padding: '12px 12px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.16)',
                          background:
                            picksRemaining !== null && picksRemaining <= 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                          color: '#fff',
                          fontWeight: 1000,
                          cursor: picksRemaining !== null && picksRemaining <= 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {picking ? 'Picking…' : 'PICK THIS PLAYER'}
                      </button>

                      <div style={{ marginTop: 8, textAlign: 'center', color: '#fff', opacity: 0.85, fontSize: 13 }}>
                        {(pickProgress.picks_made ?? 0)}/{(pickProgress.pick_count ?? 0)} picks used •{' '}
                        {picksRemaining !== null ? `${picksRemaining} remaining` : '—'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
