'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Gameweek = {
  gameweek_id: number;
  name: string;
  start_ts: string;
  end_ts: string;
};

type Competition = {
  competition_id: number;
  competition_instance_id: number;
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

type TeamRow = {
  team_id: number;
  team_name: string | null;
  short_name: string | null;
  name: string | null;
  initials: string | null;
};

type OverallPointScoreRow = Record<string, any>;

function bannerColor(kind: 'success' | 'error') {
  return kind === 'success' ? '#d1fae5' : '#fee2e2';
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
        <div style={{ fontSize: 13, color: '#555' }}>{label}</div>
        {sublabel ? <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{sublabel}</div> : null}
      </div>

      <button
        type="button"
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          border: '1px solid #e5e5e5',
          background: checked ? '#0ea5a4' : '#d1d5db',
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

function SegmentedToggle(props: {
  value: 'avg' | 'last';
  onChange: (v: 'avg' | 'last') => void;
  leftLabel: string;
  rightLabel: string;
}) {
  const { value, onChange, leftLabel, rightLabel } = props;

  const baseBtn: React.CSSProperties = {
    flex: 1,
    padding: '10px 10px',
    border: '1px solid #e9d5ff',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#555' }}>Points display</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange('avg')}
          style={{
            ...baseBtn,
            background: value === 'avg' ? '#111' : '#fff',
            color: value === 'avg' ? '#fff' : '#111',
          }}
          aria-pressed={value === 'avg'}
        >
          {leftLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange('last')}
          style={{
            ...baseBtn,
            background: value === 'last' ? '#111' : '#fff',
            color: value === 'last' ? '#fff' : '#111',
          }}
          aria-pressed={value === 'last'}
        >
          {rightLabel}
        </button>
      </div>
    </div>
  );
}

export function TeamSubmitModal(props: {
  userId: string;
  competition: Competition;
  gameweek: Gameweek;
  hasCompetitionStarted: boolean;

  editSubmissionId: number | null;
  editPrefill: { cardIds: number[]; captainCardId: number | null; viceCaptainCardId: number | null };

  onClose: () => void;
  onSuccess: (kind: 'create' | 'update') => void;
  onError: (msg: string) => void;
}) {
  const { userId, competition, gameweek } = props;

  const teamSize = competition.team_size_max ?? 6;

  const [loading, setLoading] = useState(true);
  const [ownedCards, setOwnedCards] = useState<OwnedCardRow[]>([]);
  const [usedCardIds, setUsedCardIds] = useState<Set<number>>(new Set());

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamById, setTeamById] = useState<Map<number, TeamRow>>(new Map());

  const [modalBanner, setModalBanner] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [hideUsed, setHideUsed] = useState(true);
  const [pointsMode, setPointsMode] = useState<'avg' | 'last'>('avg');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [nationalitySearch, setNationalitySearch] = useState('');

  const [selected, setSelected] = useState<number[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);
  const [viceCaptain, setViceCaptain] = useState<number | null>(null);

  const [overallScores, setOverallScores] = useState<OverallPointScoreRow[]>([]);
  const [matchById, setMatchById] = useState<Map<number, any>>(new Map());

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const isEditMode = !!props.editSubmissionId;

  useEffect(() => {
    setModalBanner(null);
  }, [props.editSubmissionId]);

  useEffect(() => {
    if (!isEditMode) {
      setSelected([]);
      setCaptain(null);
      setViceCaptain(null);
      return;
    }
    setSelected(props.editPrefill.cardIds.slice(0, teamSize));
    setCaptain(props.editPrefill.captainCardId ?? null);
    setViceCaptain(props.editPrefill.viceCaptainCardId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editSubmissionId]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: tData, error: tErr } = await supabase.from('teams').select('team_id,team_name,short_name,name,initials').order('team_id', { ascending: true });

      if (!tErr) {
        const tRows = (((tData as any) ?? []) as TeamRow[]).filter((x) => Number.isFinite(Number(x.team_id)));
        setTeams(tRows);
        const m = new Map<number, TeamRow>();
        for (const t of tRows) m.set(Number(t.team_id), t);
        setTeamById(m);
      } else {
        setTeams([]);
        setTeamById(new Map());
      }

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

      if (cardErr) {
        const msg = `Failed to load your cards: ${cardErr.message}`;
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        setOwnedCards([]);
      } else {
        setOwnedCards(((cards as any) ?? []) as OwnedCardRow[]);
      }

      const { data: used, error: usedErr } = await supabase
        .from('team_submission_cards')
        .select('card_id,submission_id')
        .eq('user_id', userId)
        .eq('gameweek_id', gameweek.gameweek_id);

      if (usedErr) {
        setUsedCardIds(new Set());
      } else {
        const editSid = props.editSubmissionId;
        const s = new Set<number>(
          (((used as any) ?? []) as any[])
            .filter((r) => (editSid ? Number(r.submission_id) !== editSid : true))
            .map((r) => Number(r.card_id))
            .filter((x) => Number.isFinite(x))
        );
        setUsedCardIds(s);
      }

      const { data: scores, error: scoreErr } = await supabase.from('v_player_overall_point_scores').select('*');
      if (scoreErr) {
        console.error('Failed to load v_player_overall_point_scores:', scoreErr.message);
        setOverallScores([]);
      } else {
        setOverallScores(((scores as any) ?? []) as OverallPointScoreRow[]);
      }

      setLoading(false);
    })();
  }, [userId, gameweek.gameweek_id, props.editSubmissionId]);

  const scoreByPlayerId = useMemo(() => {
    const m = new Map<number, OverallPointScoreRow>();
    for (const r of overallScores) {
      const pid = Number(r['Player ID']);
      if (Number.isFinite(pid) && !m.has(pid)) m.set(pid, r);
    }
    return m;
  }, [overallScores]);

  useEffect(() => {
    const ids = Array.from(scoreByPlayerId.values())
      .map((r) => toNum(r['Last Match ID']))
      .filter((x): x is number => x !== null);

    const uniq = Array.from(new Set(ids));
    if (uniq.length === 0) {
      setMatchById(new Map());
      return;
    }

    (async () => {
      const { data, error } = await supabase.from('v_matches').select('id,team_home_logo,team_away_logo').in('id', uniq);
      if (error) {
        console.error('Failed to load v_matches for last match logos:', error.message);
        return;
      }
      const m = new Map<number, any>();
      for (const row of ((data as any) ?? []) as any[]) {
        const id = Number(row.id);
        if (Number.isFinite(id)) m.set(id, row);
      }
      setMatchById(m);
    })();
  }, [scoreByPlayerId]);

  const cardToPlayerId = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of ownedCards) {
      if (row.player_id) map.set(row.card_id, row.player_id);
    }
    return map;
  }, [ownedCards]);

  const playerAlreadySelected = (playerId: number) => {
    for (const cardId of selected) {
      if (cardToPlayerId.get(cardId) === playerId) return true;
    }
    return false;
  };

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    for (const row of ownedCards) {
      if (row.role) roles.add(row.role);
    }
    return ['All', ...Array.from(roles).sort()];
  }, [ownedCards]);

  const filteredOwned = useMemo(() => {
    const s = search.trim().toLowerCase();
    const n = nationalitySearch.trim().toLowerCase();

    return ownedCards
      .filter((row) => {
        if (activeOnly) {
          if (row.is_active !== true) return false;
        }

        if (hideUsed && usedCardIds.has(row.card_id)) return false;

        if (roleFilter !== 'All' && (row.role ?? '') !== roleFilter) return false;

        if (n) {
          const team = row.country_id ? teamById.get(Number(row.country_id)) : undefined;
          const hay = [team?.initials ?? '', team?.short_name ?? '', team?.name ?? '', team?.team_name ?? ''].join(' ').toLowerCase();
          if (!hay.includes(n)) return false;
        }

        if (s) {
          const nm = (row.full_name ?? '').toLowerCase();
          if (!nm.includes(s)) return false;
        }

        return true;
      })
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
  }, [ownedCards, activeOnly, hideUsed, usedCardIds, roleFilter, nationalitySearch, search, teamById]);

  const slots = useMemo(() => {
    const arr: (number | null)[] = Array(teamSize).fill(null);
    for (let i = 0; i < Math.min(teamSize, selected.length); i++) arr[i] = selected[i];
    return arr;
  }, [selected, teamSize]);

  function addCard(cardId: number) {
    const row = ownedCards.find((r) => r.card_id === cardId);
    const playerId = row?.player_id;
    if (!row || !playerId) return;

    if (selectedSet.has(cardId)) return;

    if (selected.length >= teamSize) {
      const msg = `You can only select up to ${teamSize} players.`;
      setModalBanner({ kind: 'error', msg });
      props.onError(msg);
      return;
    }

    if (playerAlreadySelected(playerId)) {
      const msg = `You can only select one card per player in a submission.`;
      setModalBanner({ kind: 'error', msg });
      props.onError(msg);
      return;
    }

    setSelected((prev) => [...prev, cardId]);
  }

  function removeCard(cardId: number) {
    setSelected((prev) => prev.filter((x) => x !== cardId));
    setCaptain((c) => (c === cardId ? null : c));
    setViceCaptain((vc) => (vc === cardId ? null : vc));
  }

  function cardLabel(cardId: number) {
    const row = ownedCards.find((r) => r.card_id === cardId);
    return row?.full_name ?? `Card ${cardId}`;
  }

  function cardImage(cardId: number) {
    const row = ownedCards.find((r) => r.card_id === cardId);
    return assetUrl(row?.image ?? null);
  }

  function natInitials(country_id: number | null | undefined) {
    if (!country_id) return '—';
    const t = teamById.get(Number(country_id));
    return t?.initials ?? '—';
  }

  function pointsDisplayForPlayer(playerId: number | null | undefined) {
    if (!playerId) {
      return { label: pointsMode === 'avg' ? 'Avg pts / game:' : 'Last match pts:', value: '—', title: '', lastMatchId: null as number | null };
    }

    const r = scoreByPlayerId.get(Number(playerId));
    if (!r) {
      return { label: pointsMode === 'avg' ? 'Avg pts / game:' : 'Last match pts:', value: '—', title: '', lastMatchId: null as number | null };
    }

    if (pointsMode === 'avg') {
      const title = `Bat: ${fmtPts(r['Average Batting Points per game'])} | Bowl: ${fmtPts(r['Average Bowling Points per game'])} | Field: ${fmtPts(
        r['Average Fielding Points per game']
      )}`;
      return { label: 'Avg pts / game:', value: fmtPts(r['Average points per game']), title, lastMatchId: toNum(r['Last Match ID']) };
    }

    const title = `Bat: ${fmtPts(r['Batting points in last game'])} | Bowl: ${fmtPts(r['Bowling points in last game'])} | Field: ${fmtPts(
      r['Fielding points in last game']
    )}`;
    return { label: 'Last match pts:', value: fmtPts(r['Points in last game']), title, lastMatchId: toNum(r['Last Match ID']) };
  }

  async function createOrUpdateTeam() {
    try {
      setModalBanner(null);

      if (props.hasCompetitionStarted) {
        const msg = 'Competition has already started';
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        return;
      }

      if (selected.length === 0) {
        const msg = 'Select at least 1 player.';
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        return;
      }
      if (selected.length > teamSize) {
        const msg = `Max ${teamSize} players allowed.`;
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        return;
      }
      if (!captain) {
        const msg = 'Pick a captain.';
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        return;
      }
      if (viceCaptain && viceCaptain === captain) {
        const msg = 'Captain and Vice-captain cannot be the same.';
        setModalBanner({ kind: 'error', msg });
        props.onError(msg);
        return;
      }

      const cardRows = selected.map((cardId) => ({
        submission_id: props.editSubmissionId ?? 0,
        card_id: cardId,
        player_id: cardToPlayerId.get(cardId) ?? null,
        user_id: userId,
        gameweek_id: gameweek.gameweek_id,
        template_id: competition.template_id,
      }));

      if (!props.editSubmissionId) {
        const { data: sub, error: subErr } = await supabase
          .from('team_submissions')
          .insert({
            user_id: userId,
            competition_id: competition.competition_id,
            competition_instance_id: competition.competition_instance_id,
            gameweek_id: gameweek.gameweek_id,
            template_id: competition.template_id,
            is_valid: false,
            locked_at: null,
            captain_card_id: null,
            vice_captain_card_id: null,
          })
          .select('submission_id')
          .single();

        if (subErr) throw new Error(subErr.message);

        const submissionId = sub.submission_id as number;

        const insRows = cardRows.map((r) => ({ ...r, submission_id: submissionId }));
        const { error: insErr } = await supabase.from('team_submission_cards').insert(insRows);
        if (insErr) throw new Error(insErr.message);

        const { error: updErr } = await supabase
          .from('team_submissions')
          .update({
            captain_card_id: captain,
            vice_captain_card_id: viceCaptain,
            is_valid: selected.length <= teamSize,
          })
          .eq('submission_id', submissionId);

        if (updErr) throw new Error(updErr.message);

        props.onSuccess('create');
        return;
      }

      const submissionId = props.editSubmissionId;

      const { error: delErr } = await supabase.from('team_submission_cards').delete().eq('submission_id', submissionId);
      if (delErr) throw new Error(delErr.message);

      const insRows = cardRows.map((r) => ({ ...r, submission_id: submissionId }));
      const { error: insErr } = await supabase.from('team_submission_cards').insert(insRows);
      if (insErr) throw new Error(insErr.message);

      const { error: updErr } = await supabase
        .from('team_submissions')
        .update({
          captain_card_id: captain,
          vice_captain_card_id: viceCaptain,
          is_valid: selected.length <= teamSize,
        })
        .eq('submission_id', submissionId);

      if (updErr) throw new Error(updErr.message);

      props.onSuccess('update');
    } catch (e: any) {
      const msg = e?.message ?? 'Unknown error saving team.';
      setModalBanner({ kind: 'error', msg });
      props.onError(msg);
    }
  }

  const lavenderBg = '#f5f3ff';
  const lavenderBorder = '#e9d5ff';
  const ink = '#111';
  const inkSoft = '#555';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 18,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: 'min(1200px, 100%)',
          background: '#f6f6f6',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          minHeight: 640,
        }}
      >
        {/* LEFT */}
        <div style={{ flex: 1, background: '#777', padding: 18, position: 'relative' }}>
          {modalBanner?.msg && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                zIndex: 5,
                background: bannerColor(modalBanner.kind),
                border: '1px solid rgba(0,0,0,0.08)',
                padding: '10px 12px',
                borderRadius: 12,
                color: '#111',
                fontWeight: 800,
              }}
            >
              {modalBanner.msg}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              color: '#fff',
              alignItems: 'flex-start',
              paddingTop: modalBanner?.msg ? 56 : 0,
            }}
          >
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{isEditMode ? 'Edit team for' : 'Submit team for'}</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{competition.competition_name}</div>
            </div>

            <button
              onClick={props.onClose}
              aria-label="Close"
              style={{
                border: '1px solid rgba(255,255,255,0.45)',
                background: 'rgba(0,0,0,0.18)',
                color: '#fff',
                width: 40,
                height: 40,
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: 18,
                lineHeight: '40px',
                textAlign: 'center',
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              backgroundColor: '#4b7f4f',
              backgroundImage: `url(https://fantasy-cricket-assets.vercel.app/assets/pitch.png)`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 16,
              padding: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
              gap: 18,
              alignContent: 'start',
              minHeight: 520,
            }}
          >
            {slots.map((cardId, idx) => (
              <div
                key={idx}
                style={{
                  background: '#0b0b0b',
                  borderRadius: 12,
                  height: 150,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {!cardId ? (
                  <div style={{ fontSize: 64, color: '#fff', opacity: 0.9, lineHeight: 1 }}>+</div>
                ) : (
                  <div style={{ width: '100%', height: '100%', padding: 10, display: 'flex', gap: 10 }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        background: '#111',
                        border: '1px solid #222',
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {cardImage(cardId) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cardImage(cardId)!}
                          alt={cardLabel(cardId)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <span style={{ color: '#777', fontSize: 11 }}>IMG</span>
                      )}
                    </div>

                    <div style={{ flex: 1, color: '#fff' }}>
                      <div style={{ fontWeight: 900 }}>{cardLabel(cardId)}</div>

                      {(() => {
                        const playerId = cardToPlayerId.get(cardId) ?? null;
                        const p = pointsDisplayForPlayer(playerId);
                        const match = pointsMode === 'last' && p.lastMatchId ? matchById.get(p.lastMatchId) : null;

                        return (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ fontSize: 12, color: '#bbb' }} title={p.title}>
                              {p.label} <b style={{ color: '#fff' }}>{p.value}</b>
                            </div>

                            {pointsMode === 'last' && match && (
                              <div
                                onClick={() => {
                                  window.location.href = `/matches/points/${p.lastMatchId}`;
                                }}
                                style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
                                title="Open match points"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={assetUrl(match.team_home_logo) ?? ''}
                                  alt="Home"
                                  style={{ width: 16, height: 16, borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)' }}
                                />
                                <span style={{ fontSize: 12, color: '#bbb' }}>vs</span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={assetUrl(match.team_away_logo) ?? ''}
                                  alt="Away"
                                  style={{ width: 16, height: 16, borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)' }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setCaptain(cardId)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 10,
                            border: captain === cardId ? '1px solid #22c55e' : '1px solid #333',
                            background: captain === cardId ? 'rgba(34,197,94,0.15)' : '#111',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          {captain === cardId ? 'Captain ✓' : 'Make Captain'}
                        </button>

                        <button
                          onClick={() => setViceCaptain(cardId)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 10,
                            border: viceCaptain === cardId ? '1px solid #f59e0b' : '1px solid #333',
                            background: viceCaptain === cardId ? 'rgba(245,158,11,0.15)' : '#111',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          {viceCaptain === cardId ? 'VC ✓' : 'Make VC'}
                        </button>

                        <button
                          onClick={() => removeCard(cardId)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 10,
                            border: '1px solid #333',
                            background: '#111',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ width: 360, background: lavenderBg, padding: 16, color: ink, borderLeft: `1px solid ${lavenderBorder}` }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Your Players</div>

          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${lavenderBorder}`,
                background: '#fff',
                color: ink,
                outline: 'none',
              }}
            />

            <ToggleSwitch checked={activeOnly} onChange={setActiveOnly} label="Active players only" />
            <ToggleSwitch checked={hideUsed} onChange={setHideUsed} label="Hide cards already used in another submission" />

            <SegmentedToggle value={pointsMode} onChange={setPointsMode} leftLabel="Avg points" rightLabel="Last match" />

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: inkSoft }}>Role</div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${lavenderBorder}`,
                  background: '#fff',
                  color: ink,
                  outline: 'none',
                }}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: inkSoft }}>Nationality (search)</div>
              <input
                value={nationalitySearch}
                onChange={(e) => setNationalitySearch(e.target.value)}
                placeholder="Type country name (e.g., India)…"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${lavenderBorder}`,
                  background: '#fff',
                  color: ink,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: inkSoft }}>
            Showing <b>{filteredOwned.length}</b> cards
          </div>

          <div
            style={{
              marginTop: 10,
              background: '#fff',
              border: `1px solid ${lavenderBorder}`,
              borderRadius: 14,
              padding: 10,
              height: 360,
              overflow: 'auto',
            }}
          >
            {loading ? (
              <div style={{ color: inkSoft }}>Loading cards…</div>
            ) : filteredOwned.length === 0 ? (
              <div style={{ color: inkSoft }}>No cards match your filters.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {filteredOwned.map((row) => {
                  const playerId = row.player_id ?? null;
                  const p = pointsDisplayForPlayer(playerId);
                  const match = pointsMode === 'last' && p.lastMatchId ? matchById.get(p.lastMatchId) : null;

                  const disabled =
                    selectedSet.has(row.card_id) || (playerId ? playerAlreadySelected(playerId) : false) || selected.length >= teamSize;

                  return (
                    <div
                      key={row.card_id}
                      style={{
                        background: '#fff',
                        border: `1px solid ${lavenderBorder}`,
                        borderRadius: 12,
                        padding: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.full_name ?? `Card ${row.card_id}`}
                        </div>
                        <div style={{ fontSize: 12, color: inkSoft, marginTop: 2 }}>
                          Role: <b>{row.role ?? '—'}</b> • Nat: <b>{natInitials(row.country_id)}</b>
                        </div>

                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 12, color: inkSoft }} title={p.title}>
                            {p.label} <b style={{ color: '#111' }}>{p.value}</b>
                          </div>

                          {pointsMode === 'last' && match && (
                            <div
                              onClick={() => {
                                window.location.href = `/matches/points/${p.lastMatchId}`;
                              }}
                              style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
                              title="Open match points"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={assetUrl(match.team_home_logo) ?? ''}
                                alt="Home"
                                style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${lavenderBorder}` }}
                              />
                              <span style={{ fontSize: 12, color: inkSoft }}>vs</span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={assetUrl(match.team_away_logo) ?? ''}
                                alt="Away"
                                style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${lavenderBorder}` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => addCard(row.card_id)}
                        disabled={disabled}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: `1px solid ${lavenderBorder}`,
                          background: disabled ? '#f3f4f6' : '#111',
                          color: disabled ? '#777' : '#fff',
                          fontWeight: 900,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedSet.has(row.card_id) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={createOrUpdateTeam}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px 12px',
              borderRadius: 12,
              border: `1px solid ${lavenderBorder}`,
              background: '#111',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {isEditMode ? 'Update Team' : 'Submit Team'}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: inkSoft }}>
            Selected: <b>{selected.length}</b> / {teamSize}
          </div>
        </div>
      </div>
    </div>
  );
}
