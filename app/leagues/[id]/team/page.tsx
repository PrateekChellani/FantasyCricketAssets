'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type MyLeagueCardPickerRow = {
  league_card_id: number;
  league_id: number;
  user_id: string;
  player_id: number;
  source_kind: string;
  backing_card_id: number | null;
  league_card_created_at: string;

  player_full_name: string;
  player_name_display: string;
  role: string | null;
  tier: string | null;
  country_id: number | null;
  player_image: string | null;

  country_short_name: string | null;
  country_name: string | null;
  country_logo: string | null;

  card_type: string | null;
  edition: string | null;
  minted_on: string | null;

  is_selected: boolean;
  selected_at: string | null;
};

type MyTeamRow = {
  submission_id: number;
  league_id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  captain_league_card_id: number | null;
  vice_captain_league_card_id: number | null;
};

export default function LeagueTeamBuilderPage() {
  const params = useParams();
  const leagueId = Number(params?.id);

  const [picker, setPicker] = useState<MyLeagueCardPickerRow[]>([]);
  const [team, setTeam] = useState<MyTeamRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const selectedIds = useMemo(() => picker.filter((p) => p.is_selected).map((p) => p.league_card_id), [picker]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    // Ensure the user has a submission row for this league
    await supabase.rpc('upsert_my_league_team', { p_league_id: leagueId });

    const [teamRes, pickRes] = await Promise.all([
      supabase.from('v_my_league_team').select('*').eq('league_id', leagueId).maybeSingle(),
      supabase.from('v_my_league_card_picker').select('*').eq('league_id', leagueId).order('player_name_display'),
    ]);

    if (teamRes.error) setErrorMsg(teamRes.error.message);
    if (pickRes.error) setErrorMsg((prev) => prev ?? pickRes.error!.message);

    setTeam((teamRes.data as any) ?? null);
    setPicker(((pickRes.data as any) ?? []) as MyLeagueCardPickerRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!leagueId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  function toggleSelect(id: number) {
    setPicker((prev) =>
      prev.map((p) => (p.league_card_id === id ? { ...p, is_selected: !p.is_selected } : p)),
    );
  }

  async function saveTeam() {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);

    const chosen = selectedIds;

    const setRes = await supabase.rpc('set_my_league_team_cards', {
      p_league_id: leagueId,
      p_league_card_ids: chosen,
    });

    if (setRes.error) {
      setErrorMsg(setRes.error.message);
      setBusy(false);
      return;
    }

    // Captains validation: must be in selection if set
    const cap = team?.captain_league_card_id ?? null;
    const vc = team?.vice_captain_league_card_id ?? null;

    if (cap && !chosen.includes(cap)) {
      await supabase.rpc('set_my_league_captains', {
        p_league_id: leagueId,
        p_captain_league_card_id: null,
        p_vice_captain_league_card_id: vc && chosen.includes(vc) ? vc : null,
      });
    }
    if (vc && !chosen.includes(vc)) {
      await supabase.rpc('set_my_league_captains', {
        p_league_id: leagueId,
        p_captain_league_card_id: cap && chosen.includes(cap) ? cap : null,
        p_vice_captain_league_card_id: null,
      });
    }

    setInfoMsg('Saved!');
    setBusy(false);
    await load();
  }

  async function setCaptains(captainId: number | null, viceId: number | null) {
    setErrorMsg(null);
    setInfoMsg(null);

    if (captainId && viceId && captainId === viceId) {
      setErrorMsg('Captain and Vice-Captain must be different.');
      return;
    }
    if (captainId && !selectedIds.includes(captainId)) {
      setErrorMsg('Captain must be selected in your team.');
      return;
    }
    if (viceId && !selectedIds.includes(viceId)) {
      setErrorMsg('Vice-Captain must be selected in your team.');
      return;
    }

    setBusy(true);
    const res = await supabase.rpc('set_my_league_captains', {
      p_league_id: leagueId,
      p_captain_league_card_id: captainId,
      p_vice_captain_league_card_id: viceId,
    });
    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }
    setInfoMsg('Captains updated!');
    await load();
  }

  const selectedRows = useMemo(() => picker.filter((p) => p.is_selected), [picker]);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>My League Team</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Select cards, then set captain / vice-captain. You can edit anytime.
          </div>
        </div>
        <Link href={`/leagues/${leagueId}`} style={{ opacity: 0.9 }}>
          ← Back
        </Link>
      </div>

      {(loading || errorMsg || infoMsg) && (
        <div style={{ marginTop: 14 }}>
          {loading && <div style={{ opacity: 0.8 }}>Loading…</div>}
          {errorMsg && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(255,70,70,0.35)',
                background: 'rgba(255,70,70,0.08)',
              }}
            >
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div
              style={{
                marginTop: errorMsg ? 10 : 10,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(80,200,120,0.35)',
                background: 'rgba(80,200,120,0.08)',
              }}
            >
              {infoMsg}
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
          {/* Picker */}
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Card Picker</div>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Selected: <b>{selectedIds.length}</b>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {picker.length === 0 ? (
                <div style={{ opacity: 0.75 }}>
                  No eligible cards found. (You might not have league cards minted/assigned yet.)
                </div>
              ) : (
                picker.map((c) => (
                  <div
                    key={c.league_card_id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: 10,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: c.is_selected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <input type="checkbox" checked={c.is_selected} onChange={() => toggleSelect(c.league_card_id)} />
                    <img
                      src={
                        c.player_image
                          ? `https://fantasy-cricket-assets.vercel.app/${c.player_image}`
                          : '/public/default_player.png'
                      }
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 950 }}>{c.player_name_display}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        {c.role ?? '—'} • {c.tier ?? '—'} • {c.country_short_name ?? '—'}
                      </div>
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 12, textAlign: 'right' }}>
                      <div>League card #{c.league_card_id}</div>
                      <div>{c.edition ?? '—'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                disabled={busy}
                onClick={saveTeam}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.10)',
                  cursor: 'pointer',
                  fontWeight: 950,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Saving…' : 'Save Team'}
              </button>
            </div>
          </div>

          {/* Selected + captains */}
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 950 }}>My Selection</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>Set captain + vice-captain from selected.</div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {selectedRows.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Pick some cards on the left.</div>
              ) : (
                selectedRows.map((c) => {
                  const isCap = team?.captain_league_card_id === c.league_card_id;
                  const isVc = team?.vice_captain_league_card_id === c.league_card_id;

                  return (
                    <div
                      key={c.league_card_id}
                      style={{
                        padding: 10,
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: isCap ? 'rgba(255,215,0,0.10)' : isVc ? 'rgba(180,180,255,0.10)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={
                            c.player_image
                              ? `https://fantasy-cricket-assets.vercel.app/${c.player_image}`
                              : '/public/default_player.png'
                          }
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 950 }}>
                            {c.player_name_display}{' '}
                            {isCap && <span style={{ opacity: 0.9 }}>• CAP</span>}
                            {isVc && <span style={{ opacity: 0.9 }}>• VC</span>}
                          </div>
                          <div style={{ opacity: 0.75, fontSize: 13 }}>{c.role ?? '—'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            disabled={busy}
                            onClick={() => setCaptains(c.league_card_id, team?.vice_captain_league_card_id ?? null)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 12,
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: isCap ? 'rgba(255,255,255,0.10)' : 'transparent',
                              cursor: 'pointer',
                              fontWeight: 900,
                            }}
                          >
                            Captain
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setCaptains(team?.captain_league_card_id ?? null, c.league_card_id)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 12,
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: isVc ? 'rgba(255,255,255,0.10)' : 'transparent',
                              cursor: 'pointer',
                              fontWeight: 900,
                            }}
                          >
                            VC
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                disabled={busy}
                onClick={() => setCaptains(null, null)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 900,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Clear Captains
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
