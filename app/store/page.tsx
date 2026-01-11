'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  pack_image: string | null;
};

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
}

function packImgUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

export default function StorePage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PackTemplate[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const [confirmBuy, setConfirmBuy] = useState<PackTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    setBanner(null);

    const { data, error } = await supabase
      .from('pack_templates')
      .select(
        `
        pack_template_id,
        template_key,
        name,
        description,
        kind,
        reveal_count,
        pick_count,
        cp_cost,
        player_filter,
        tier_weights,
        is_active,
        created_at,
        pack_image
      `
      )
      .eq('is_active', true)
      .order('cp_cost', { ascending: true });

    if (error) {
      setBanner({ kind: 'error', msg: `Failed to load store packs: ${error.message}` });
      setTemplates([]);
    } else {
      setTemplates((data as any) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (error) setBanner({ kind: 'error', msg: `Auth error: ${error.message}` });
      setUserId(uid);

      await loadTemplates();
    })();
  }, []);

  const byKind = useMemo(() => {
    const packs = templates.filter((t) => (t.kind ?? '').toLowerCase() === 'pack');
    const picks = templates.filter((t) => (t.kind ?? '').toLowerCase() === 'pick');
    const other = templates.filter((t) => !['pack', 'pick'].includes((t.kind ?? '').toLowerCase()));
    return { packs, picks, other };
  }, [templates]);

  async function doPurchase(t: PackTemplate) {
    if (!userId) {
      setBanner({ kind: 'error', msg: 'Please sign in to buy packs.' });
      return;
    }

    try {
      setBusy(true);
      setBanner(null);

      const { data, error } = await supabase.rpc('purchase_pack', {
        p_user_id: userId,
        p_pack_template_id: t.pack_template_id,
      });

      if (error) throw new Error(error.message);

      const newPackInstanceId = data as unknown as number;

      setBanner({
        kind: 'success',
        msg: `Success! Pack added to My Packs.`,
      });

      setConfirmBuy(null);

      // ✅ Force CPBalance refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cp:changed'));
      }
    } catch (e: any) {
      setBanner({ kind: 'error', msg: e?.message ?? 'Failed to purchase pack.' });
    } finally {
      setBusy(false);
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

  function StoreGrid(props: { items: PackTemplate[] }) {
    const items = props.items;
    if (items.length === 0) return <div style={{ color: '#666' }}>None available.</div>;

    return (
      <>
        <style>{`
          .store-grid{
            display:grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            align-items: stretch;
          }
          @media (max-width: 1100px){
            .store-grid{ grid-template-columns: repeat(3, minmax(0, 1fr)); }
          }
          @media (max-width: 820px){
            .store-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 520px){
            .store-grid{ grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="store-grid">
          {items.map((t) => {
            const img = packImgUrl(t.pack_image);
            const hasPicks = (t.pick_count ?? 0) > 0;

            const revealsLabel = hasPicks ? 'Cards seen' : 'Cards you get';
            const picksLabel = 'Picks you get';

            return (
              <div
                key={t.pack_template_id}
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
                {/* Top image area (no zoom/crop) */}
                <div
                  style={{
                    height: 140,
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
                      alt={t.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain', // ✅ no crop
                        display: 'block',
                        padding: 10, // ✅ a little breathing room
                      }}
                    />
                  ) : (
                    <div style={{ color: '#fff', opacity: 0.8, fontWeight: 900 }}>No Image</div>
                  )}
                </div>

                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 1000, textAlign: 'center', lineHeight: 1.15 }}>{t.name}</div>

                  <div style={{ fontSize: 12, color: '#666', textAlign: 'center', minHeight: 34 }}>{t.description ?? '—'}</div>

                  <div style={{ textAlign: 'center', fontSize: 14, color: '#444' }}>
                    Cost: <b style={{ color: '#111', fontSize: 16 }}>{t.cp_cost ?? '—'} Cover Points</b>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    <StatBox label={revealsLabel} value={t.reveal_count} />
                    {hasPicks ? <StatBox label={picksLabel} value={t.pick_count} /> : null}
                  </div>
                </div>

                <div style={{ padding: 12, paddingTop: 0, marginTop: 'auto' }}>
                  <button
                    onClick={() => setConfirmBuy(t)}
                    disabled={!userId || busy}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #111',
                      background: !userId || busy ? '#eee' : '#111',
                      color: !userId || busy ? '#777' : '#fff',
                      fontWeight: 1000,
                      cursor: !userId || busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Buy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Store</h1>
          <p style={{ marginTop: 6, color: '#555' }}>Packs can be purchased using Cover Points. Purchased packs usually appear in My Packs instantly, but it may take up to an hour.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/play/MyPacks"
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
            Go to My Packs
          </Link>

          <button
            onClick={() => loadTemplates()}
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
      ) : (
        <>
          <h2 style={{ marginTop: 18 }}>Packs</h2>
          <StoreGrid items={byKind.packs} />

          <h2 style={{ marginTop: 22 }}>Picks</h2>
          <StoreGrid items={byKind.picks} />

          {byKind.other.length > 0 && (
            <>
              <h2 style={{ marginTop: 22 }}>Other</h2>
              <StoreGrid items={byKind.other} />
            </>
          )}
        </>
      )}

      {confirmBuy && (
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
            if (e.target === e.currentTarget) setConfirmBuy(null);
          }}
        >
          <div
            style={{
              width: 'min(560px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              border: '1px solid #e5e5e5',
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Buy this pack?</div>
            <div style={{ marginTop: 8, color: '#555' }}>
              Are you sure you want to buy <b>{confirmBuy.name}</b> for <b>{confirmBuy.cp_cost ?? '—'} Cover Points</b>? This action cannot be undone.
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmBuy(null)}
                disabled={busy}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  color: '#111',
                  fontWeight: 900,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => doPurchase(confirmBuy)}
                disabled={busy || !userId}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #111',
                  background: '#111',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: busy || !userId ? 'not-allowed' : 'pointer',
                }}
              >
                Yes, buy
              </button>
            </div>

            {!userId && <div style={{ marginTop: 10, color: '#b91c1c' }}>You must be signed in to purchase.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
