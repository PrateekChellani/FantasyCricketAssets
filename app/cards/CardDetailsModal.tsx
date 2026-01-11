'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

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

  trade_blocked?: boolean | null;
  owner_display_name?: string | null;
};

type TeamLookupRow = {
  team_id: number;
  short_name: string | null;
  name: string | null;
  logo: string | null;
};

type OverallPointScoreRow = Record<string, any>;

function badgeStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    color: '#111',
    border: '1px solid rgba(0,0,0,0.12)',
  };
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

function StatCard(props: { label: string; value: any; title?: string }) {
  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 12, background: '#fff' }} title={props.title ?? ''}>
      <div style={{ fontSize: 12, color: '#666' }}>{props.label}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 4 }}>{String(props.value)}</div>
    </div>
  );
}

function Row(props: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ color: '#666' }}>{props.label}</div>
      <div style={{ fontWeight: 800, textAlign: 'right' }}>{String(props.value)}</div>
    </div>
  );
}

export default function CardDetailsModal(props: {
  open: boolean;
  onClose: () => void;

  selected: MyCardRow | null;

  teamById: Record<number, TeamLookupRow>;
  overallScores: OverallPointScoreRow[];
}) {
  const { open, onClose, selected, teamById, overallScores } = props;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // local UI state so the modal can immediately reflect the toggle
  const [tradeBlockedLocal, setTradeBlockedLocal] = useState<boolean | null>(null);

  // authoritative owner fields (refetched on open)
  const [ownerDisplayNameLocal, setOwnerDisplayNameLocal] = useState<string | null>(null);
  const [ownerUserIdLocal, setOwnerUserIdLocal] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  useEffect(() => {
    if (!open) return;

    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    })();
  }, [open]);

  useEffect(() => {
    // whenever a new card opens, reset local trade state + messages
    if (!open || !selected) return;

    setToast(null);
    setBusy(false);

    // seed from selected (may be missing fields on some pages)
    setTradeBlockedLocal(typeof selected.trade_blocked === 'boolean' ? selected.trade_blocked : null);
    setOwnerDisplayNameLocal((selected.owner_display_name ?? '').trim() || null);
    setOwnerUserIdLocal(selected.user_id ?? null);

    // ✅ Refetch authoritative owner + trade status for this card
    (async () => {
      const { data, error } = await supabase
        .from('v_my_player_cards')
        .select('user_id, trade_blocked, owner_display_name')
        .eq('card_id', selected.card_id)
        .maybeSingle();

      if (error) return;

      const userId = (data as any)?.user_id ?? null;
      const tb = (data as any)?.trade_blocked;
      const od = (data as any)?.owner_display_name;

      setOwnerUserIdLocal(userId);
      setOwnerDisplayNameLocal(String(od ?? '').trim() || null);
      setTradeBlockedLocal(typeof tb === 'boolean' ? tb : false);
    })();
  }, [open, selected?.card_id]);

  const scoreByPlayerId = useMemo(() => {
    const m = new Map<number, OverallPointScoreRow>();
    for (const r of overallScores) {
      const pid = Number(r['Player ID']);
      if (Number.isFinite(pid) && !m.has(pid)) m.set(pid, r);
    }
    return m;
  }, [overallScores]);

  function pointsDisplayForPlayer(playerId: number | null | undefined) {
    const base = { value: '—', title: '' };
    if (!playerId) return base;

    const r = scoreByPlayerId.get(Number(playerId));
    if (!r) return base;

    const title = `Bat: ${fmtPts(r['Batting points in last game'])} | Bowl: ${fmtPts(r['Bowling points in last game'])} | Field: ${fmtPts(
      r['Fielding points in last game']
    )} | Misc: ${fmtPts(r['Misc points last game'])}`;

    return { value: fmtPts(r['Points in last game']), title };
  }

  const selectedTeam = useMemo(() => {
    if (!selected?.country_id) return undefined;
    return teamById[selected.country_id];
  }, [selected?.country_id, teamById]);

  const selectedNationName = selectedTeam?.name ?? selectedTeam?.short_name ?? (selected?.country_id ?? '—');

  const selectedTeamLogoUrl = assetUrl(selectedTeam?.logo ?? null);
  const selectedPlayerImageUrl = assetUrl(selected?.image ?? null);

  if (!open || !selected) return null;

  // ✅ after this line, `selected` is guaranteed non-null
  const selectedCardId = selected.card_id;

  const p = pointsDisplayForPlayer(selected.player_id ?? null);

  const effectiveOwnerUserId = ownerUserIdLocal ?? selected.user_id;
  const isOwner = !!currentUserId && !!effectiveOwnerUserId && currentUserId === effectiveOwnerUserId;

  const tradeBlocked =
    tradeBlockedLocal !== null
      ? tradeBlockedLocal
      : typeof selected.trade_blocked === 'boolean'
        ? selected.trade_blocked
        : false;

  const isAvailableForTrade = !tradeBlocked;

  // ✅ Mimic your working page behavior:
  // display: owner_display_name ?? user_id
  // link: /profile/{display_name} else /users/{user_id}
  const ownerDisplay = ownerDisplayNameLocal ?? effectiveOwnerUserId ?? '—';
  const ownerHref = ownerDisplayNameLocal
    ? `/profile/${encodeURIComponent(ownerDisplayNameLocal)}`
    : effectiveOwnerUserId
      ? `/users/${effectiveOwnerUserId}`
      : '#';

  async function toggleTradeBlocked() {
    if (!isOwner) return;

    const next = !tradeBlocked; // true => make unavailable, false => make available
    setBusy(true);
    setToast(null);

    const { error } = await supabase.rpc('set_card_trade_blocked', {
      p_card_id: selectedCardId,
      p_trade_blocked: next,
    });

    if (error) {
      setToast({ kind: 'error', msg: error.message });
      setBusy(false);
      return;
    }

    setTradeBlockedLocal(next);
    setToast({ kind: 'success', msg: next ? 'Card marked unavailable for trade.' : 'Card marked available for trade.' });
    setBusy(false);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1040px, 100%)',
          borderRadius: 16,
          background: '#fff',
          border: '1px solid #e5e5e5',
          overflow: 'hidden',
          boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
          <div style={{ fontWeight: 950 }}>Card Details</div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 10,
              border: '1px solid #e5e5e5',
              background: '#fff',
              padding: '8px 10px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 0 }}>
          {/* Image / card */}
          <div style={{ padding: 18, background: '#111', color: '#fff' }}>
            <div
              style={{
                borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
                border: '1px solid rgba(255,255,255,0.14)',
                padding: 14,
                height: 520,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={badgeStyle('#fbbf24')}>{selected.card_type}</div>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>#{selected.card_id}</div>
              </div>

              <div
                style={{
                  flex: 1,
                  marginTop: 12,
                  borderRadius: 16,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selectedPlayerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPlayerImageUrl} alt={selected.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>Player Image</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.15 }}>{selected.full_name}</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{selected.role ?? '—'}</span>
                  <span style={{ opacity: 0.6 }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {selectedTeamLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedTeamLogoUrl}
                        alt={String(selectedNationName)}
                        style={{ width: 18, height: 18, borderRadius: 999, objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                    <span>{String(selectedNationName)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: 18 }}>
            {toast ? (
              <div
                style={{
                  marginBottom: 10,
                  background: toast.kind === 'error' ? '#fee2e2' : '#d1fae5',
                  border: '1px solid #e5e5e5',
                  padding: '10px 12px',
                  borderRadius: 10,
                }}
              >
                {toast.msg}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: '#666' }}>Player</div>
                <div style={{ fontSize: 22, fontWeight: 950, marginTop: 2 }}>
                  <Link href={`/players/${selected.player_id}`} style={{ textDecoration: 'none', color: '#111' }}>
                    {selected.full_name}
                  </Link>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
                  Card ID <b>#{selected.card_id}</b> • Minted <b>{new Date(selected.minted_on).toLocaleString()}</b>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {selected.burned_on ? (
                  <span style={badgeStyle('#fecaca')}>Burned</span>
                ) : selected.is_active ? (
                  <span style={badgeStyle('#bbf7d0')}>Active</span>
                ) : (
                  <span style={badgeStyle('#fde68a')}>Inactive</span>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <StatCard label="Last Match Points" value={p.value} title={p.title} />
              <StatCard label="Points Earned (lifetime)" value={fmtPts(selected.points_earned)} />
              <StatCard label="Matches Selected" value={selected.matches_selected ?? 0} />
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Card metadata</div>

              <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 13, color: '#333' }}>
                <Row label="Role" value={selected.role ?? '—'} />
                <Row label="Nation" value={selectedNationName ?? '—'} />
                <Row label="Acquired on" value={new Date(selected.acquired_on).toLocaleString()} />
                <Row label="Number of Owners" value={selected.owners_count ?? '—'} />

                {/* ✅ Current Owner (mimic the working page logic) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ color: '#666' }}>Current Owner</div>
                  <div style={{ fontWeight: 800, textAlign: 'right' }}>
                    {ownerHref !== '#' ? (
                      <Link href={ownerHref} style={{ textDecoration: 'underline', color: '#111' }}>
                        {ownerDisplay}
                      </Link>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>

                <Row label="Is Available for Trade" value={isAvailableForTrade ? 'Yes' : 'No'} />

                {isOwner ? (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={toggleTradeBlocked}
                      disabled={busy}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #e5e5e5',
                        background: busy ? '#f3f4f6' : '#fff',
                        padding: '10px 12px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        fontWeight: 900,
                      }}
                      title="Toggles trade availability for your card"
                    >
                      {tradeBlocked ? 'Make Available for Trade' : 'Make Unavailable for Trade'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
