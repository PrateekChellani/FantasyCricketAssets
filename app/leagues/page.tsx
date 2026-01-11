'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

type TabKey = 'public' | 'private';

type LeagueVisibility = 'PUBLIC' | 'PRIVATE';

type LeagueDiscoverRow = {
  league_id: number;
  name: string;
  description: string | null;
  visibility: LeagueVisibility;
  owner_user_id: string;
  owner_display_name: string | null;
  max_users: number | null;
  start_ts: string | null;
  end_ts: string | null;
  allowed_formats: string[] | null;
  update_policy: string | null;
  created_at: string;
  active_members_count: number | null;
};

type MyLeagueRow = {
  league_id: number;
  name: string;
  description: string | null;
  visibility: LeagueVisibility;
  owner_user_id: string;
  owner_display_name: string | null;
  max_users: number | null;
  start_ts: string | null;
  end_ts: string | null;
  allowed_formats: string[] | null;
  update_policy: string | null;
  created_at: string;
  joined_at: string | null;
  my_status: string | null;
  active_members_count: number | null;
};

type FormatRow = { format: string };

type MatchCompRow = { competition_id: number | null; competition: string | null };

function toIsoWithTime(dateStr: string, time: 'start' | 'end') {
  // dateStr: YYYY-MM-DD (local). We’ll store a UTC-ish ISO with an explicit time.
  // Supabase accepts ISO strings; Postgres will cast to timestamptz.
  if (!dateStr) return null;
  return time === 'start'
    ? `${dateStr}T00:00:00.000Z`
    : `${dateStr}T23:59:59.000Z`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // Handle month rollover (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function LeaguesPage() {
  const [tab, setTab] = useState<TabKey>('public');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [publicLeagues, setPublicLeagues] = useState<LeagueDiscoverRow[]>([]);
  const [myLeagues, setMyLeagues] = useState<MyLeagueRow[]>([]);

  // Join private league
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const now = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => yyyyMmDd(now), [now]);
  const defaultEnd = useMemo(() => yyyyMmDd(addMonths(now, 4)), [now]);

  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cMaxUsers, setCMaxUsers] = useState<number>(18);
  const [cStartDate, setCStartDate] = useState(defaultStart);
  const [cEndDate, setCEndDate] = useState(defaultEnd);

  const [formatOptions, setFormatOptions] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['T20I']);

  const [tournamentOptions, setTournamentOptions] = useState<
    { competition_id: number; competition: string }[]
  >([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<number[]>([]);

  const [updatePolicy, setUpdatePolicy] = useState<'LOCK_PER_GAMEWEEK' | 'LIVE' | 'LOCK_ON_SUBMIT'>(
    'LOCK_PER_GAMEWEEK'
  );

  // Load public + my leagues
  async function refreshLists() {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: pub, error: pubErr }, { data: mine, error: mineErr }] = await Promise.all([
        supabase
          .from('v_leagues_discover')
          .select(
            'league_id,name,description,visibility,owner_user_id,owner_display_name,max_users,start_ts,end_ts,allowed_formats,update_policy,created_at,active_members_count'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('v_my_leagues')
          .select(
            'league_id,name,description,visibility,owner_user_id,owner_display_name,max_users,start_ts,end_ts,allowed_formats,update_policy,created_at,joined_at,my_status,active_members_count'
          )
          .order('joined_at', { ascending: false }),
      ]);

      if (pubErr) throw pubErr;
      if (mineErr) throw mineErr;

      setPublicLeagues((pub ?? []) as any);
      setMyLeagues((mine ?? []) as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load leagues.');
    } finally {
      setLoading(false);
    }
  }

  // Load formats
  async function refreshFormats() {
    const { data, error } = await supabase.from('v_formats').select('format').order('format');
    if (!error) setFormatOptions((data as FormatRow[] | null)?.map((r) => r.format) ?? []);
  }

  // Load tournaments based on current selected date range (from v_matches_overview)
  async function refreshTournamentsForRange(startDate: string, endDate: string) {
    // v_matches_overview.match_date is DATE, so filter by date strings.
    const { data, error } = await supabase
      .from('v_matches_overview')
      .select('competition_id,competition')
      .gte('match_date', startDate)
      .lte('match_date', endDate)
      .order('competition', { ascending: true });

    if (error) {
      // Don’t block the modal if tournaments fail; user can leave “all competitions”.
      setTournamentOptions([]);
      return;
    }

    const rows = (data as MatchCompRow[] | null) ?? [];
    const seen = new Set<number>();
    const opts: { competition_id: number; competition: string }[] = [];

    for (const r of rows) {
      if (r.competition_id == null) continue;
      if (seen.has(r.competition_id)) continue;
      seen.add(r.competition_id);
      opts.push({
        competition_id: r.competition_id,
        competition: r.competition ?? `Competition ${r.competition_id}`,
      });
    }

    setTournamentOptions(opts);
  }

  useEffect(() => {
    refreshLists();
    refreshFormats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever create modal opens, refresh tournaments for default range
  useEffect(() => {
    if (!showCreate) return;
    refreshTournamentsForRange(cStartDate, cEndDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate]);

  // Also refresh tournament list if the date range changes while modal is open
  useEffect(() => {
    if (!showCreate) return;
    refreshTournamentsForRange(cStartDate, cEndDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cStartDate, cEndDate, showCreate]);

  async function onJoinByCode() {
    setJoining(true);
    setErr(null);
    setToast(null);

    const code = joinCode.trim();
    if (!code) {
      setErr('Enter a join code.');
      setJoining(false);
      return;
    }

    try {
      // Assumes your RPC is public.join_league_by_code(p_join_code text)
      const { error } = await supabase.rpc('join_league_by_code', {
        p_join_code: code,
      });

      if (error) throw error;

      setToast('Joined league!');
      setJoinCode('');
      await refreshLists();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to join league.');
    } finally {
      setJoining(false);
    }
  }

  async function onCreateLeague() {
    setCreating(true);
    setErr(null);
    setToast(null);

    try {
      const name = cName.trim();
      if (!name) throw new Error('League name required.');

      // Build rules JSONB for competitions (optional). Your SQL views use app._league_competition_ids(l.rules)
      // We’ll store: { competition_ids: [1,2,3] } only if user selected any.
      const rules =
        selectedCompetitions.length > 0
          ? { competition_ids: selectedCompetitions }
          : {}; // all competitions

      // IMPORTANT: your fixed function returns TABLE(out_league_id, out_join_code)
      const { data, error } = await supabase.rpc('create_private_league', {
        p_name: name,
        p_description: cDesc.trim() || null,
        p_max_users: cMaxUsers ?? 18,
        p_start_ts: toIsoWithTime(cStartDate, 'start'),
        p_end_ts: toIsoWithTime(cEndDate, 'end'),
        p_allowed_formats: selectedFormats.length > 0 ? selectedFormats : null,
        p_rules: rules,
        p_update_policy: updatePolicy,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      const outLeagueId = row?.out_league_id ?? row?.league_id;
      const outJoinCode = row?.out_join_code ?? row?.join_code;

      setToast(
        outJoinCode
          ? `League created! Join code: ${outJoinCode}`
          : 'League created!'
      );

      // Close modal + refresh
      setShowCreate(false);
      setCName('');
      setCDesc('');
      setCMaxUsers(18);
      setSelectedFormats(['T20I']);
      setSelectedCompetitions([]);
      setUpdatePolicy('LOCK_PER_GAMEWEEK');

      await refreshLists();

      // If we have league id, navigate hint (we’ll keep as a link in toast)
      if (outLeagueId) {
        // no router dependency; user can click in list
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create league.');
    } finally {
      setCreating(false);
    }
  }

  function toggleInList<T extends string | number>(value: T, list: T[], setList: (v: T[]) => void) {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else setList([...list, value]);
  }

  const myLeaguesSorted = useMemo(() => {
    return [...myLeagues].sort((a, b) => {
      const ta = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const tb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return tb - ta;
    });
  }, [myLeagues]);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950 }}>Leagues</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Join public leagues, or enter a code to join private leagues. Create your own private league anytime.
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
          }}
        >
          + Create League
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          onClick={() => setTab('public')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontWeight: 850,
            cursor: 'pointer',
            border: tab === 'public' ? '2px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
            opacity: tab === 'public' ? 1 : 0.75,
          }}
        >
          Public
        </button>
        <button
          onClick={() => setTab('private')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontWeight: 850,
            cursor: 'pointer',
            border: tab === 'private' ? '2px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
            opacity: tab === 'private' ? 1 : 0.75,
          }}
        >
          Private
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => refreshLists()}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Messages */}
      {err && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(255,0,0,0.08)',
            border: '1px solid rgba(255,0,0,0.25)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {err}
        </div>
      )}
      {toast && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(0,255,0,0.08)',
            border: '1px solid rgba(0,255,0,0.25)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {toast}
        </div>
      )}

      {/* Content */}
      {tab === 'public' ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Discover public leagues</div>

          {loading && publicLeagues.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Loading…</div>
          ) : publicLeagues.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No public leagues found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {publicLeagues.map((l) => (
                <div
                  key={l.league_id}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 950 }}>{l.name}</div>
                    <div style={{ opacity: 0.75, fontWeight: 800 }}>PUBLIC</div>
                  </div>

                  {l.description && <div style={{ marginTop: 6, opacity: 0.8 }}>{l.description}</div>}

                  <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13, lineHeight: 1.35 }}>
                    <div>
                      Owner: <span style={{ fontWeight: 850 }}>{l.owner_display_name ?? '—'}</span>
                    </div>
                    <div>
                      Members: <span style={{ fontWeight: 850 }}>{l.active_members_count ?? 0}</span> /{' '}
                      <span style={{ fontWeight: 850 }}>{l.max_users ?? '—'}</span>
                    </div>
                    <div>
                      Dates:{' '}
                      <span style={{ fontWeight: 850 }}>
                        {l.start_ts ? new Date(l.start_ts).toLocaleDateString() : '—'} →{' '}
                        {l.end_ts ? new Date(l.end_ts).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      Formats:{' '}
                      <span style={{ fontWeight: 850 }}>
                        {l.allowed_formats && l.allowed_formats.length > 0 ? l.allowed_formats.join(', ') : 'All'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <Link
                      href={`/leagues/${l.league_id}`}
                      style={{
                        display: 'inline-block',
                        padding: '10px 12px',
                        borderRadius: 12,
                        fontWeight: 900,
                        border: '1px solid rgba(255,255,255,0.12)',
                        textDecoration: 'none',
                      }}
                    >
                      View
                    </Link>
                    <div style={{ flex: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Join box */}
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950 }}>Join a private league</div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              Enter a join code from a league owner or another league member.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter join code"
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(0,0,0,0.2)',
                  minWidth: 220,
                  fontWeight: 800,
                  letterSpacing: 1,
                }}
              />
              <button
                onClick={onJoinByCode}
                disabled={joining}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontWeight: 900,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: joining ? 'not-allowed' : 'pointer',
                  opacity: joining ? 0.6 : 1,
                }}
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontWeight: 900,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                }}
              >
                + Create League
              </button>
            </div>
          </div>

          {/* My leagues */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>My leagues</div>

            {loading && myLeaguesSorted.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Loading…</div>
            ) : myLeaguesSorted.length === 0 ? (
              <div style={{ opacity: 0.7 }}>You’re not in any leagues yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                {myLeaguesSorted.map((l) => (
                  <div
                    key={l.league_id}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>{l.name}</div>
                      <div style={{ opacity: 0.75, fontWeight: 900 }}>{l.visibility}</div>
                    </div>

                    {l.description && <div style={{ marginTop: 6, opacity: 0.8 }}>{l.description}</div>}

                    <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13, lineHeight: 1.35 }}>
                      <div>
                        Owner: <span style={{ fontWeight: 850 }}>{l.owner_display_name ?? '—'}</span>
                      </div>
                      <div>
                        Members: <span style={{ fontWeight: 850 }}>{l.active_members_count ?? 0}</span> /{' '}
                        <span style={{ fontWeight: 850 }}>{l.max_users ?? '—'}</span>
                      </div>
                      <div>
                        Dates:{' '}
                        <span style={{ fontWeight: 850 }}>
                          {l.start_ts ? new Date(l.start_ts).toLocaleDateString() : '—'} →{' '}
                          {l.end_ts ? new Date(l.end_ts).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div>
                        Formats:{' '}
                        <span style={{ fontWeight: 850 }}>
                          {l.allowed_formats && l.allowed_formats.length > 0 ? l.allowed_formats.join(', ') : 'All'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <Link
                        href={`/leagues/${l.league_id}`}
                        style={{
                          display: 'inline-block',
                          padding: '10px 12px',
                          borderRadius: 12,
                          fontWeight: 900,
                          border: '1px solid rgba(255,255,255,0.12)',
                          textDecoration: 'none',
                        }}
                      >
                        Open
                      </Link>
                      <div style={{ flex: 1 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          onClick={() => {
            if (!creating) setShowCreate(false);
          }}
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
              width: 'min(820px, 100%)',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(20,20,20,0.95)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>Create a private league</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  Choose dates + optional filters (formats/tournaments). Filters are locked after creation.
                </div>
              </div>

              <button
                onClick={() => {
                  if (!creating) setShowCreate(false);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontWeight: 900,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>League name</div>
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Dubai T20I Champs"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Max users</div>
                <input
                  type="number"
                  value={cMaxUsers}
                  onChange={(e) => setCMaxUsers(Number(e.target.value))}
                  min={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Description (optional)</div>
                <input
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder="Short description"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Start date</div>
                <input
                  type="date"
                  value={cStartDate}
                  onChange={(e) => setCStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>End date</div>
                <input
                  type="date"
                  value={cEndDate}
                  onChange={(e) => setCEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Allowed formats (optional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {formatOptions.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>No format options found.</div>
                  ) : (
                    formatOptions.map((f) => {
                      const active = selectedFormats.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() => toggleInList(f, selectedFormats, setSelectedFormats)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 999,
                            fontWeight: 900,
                            cursor: 'pointer',
                            border: active
                              ? '1px solid rgba(255,255,255,0.5)'
                              : '1px solid rgba(255,255,255,0.14)',
                            background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                            opacity: active ? 1 : 0.8,
                          }}
                        >
                          {f}
                        </button>
                      );
                    })
                  )}
                </div>
                <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                  If you select none, it means “all formats”.
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Tournaments (optional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tournamentOptions.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>
                      No tournaments found for this date range (or not loaded). Leaving blank means “all tournaments”.
                    </div>
                  ) : (
                    tournamentOptions.map((t) => {
                      const active = selectedCompetitions.includes(t.competition_id);
                      return (
                        <button
                          key={t.competition_id}
                          onClick={() =>
                            toggleInList(t.competition_id, selectedCompetitions, setSelectedCompetitions)
                          }
                          style={{
                            padding: '8px 10px',
                            borderRadius: 999,
                            fontWeight: 900,
                            cursor: 'pointer',
                            border: active
                              ? '1px solid rgba(255,255,255,0.5)'
                              : '1px solid rgba(255,255,255,0.14)',
                            background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                            opacity: active ? 1 : 0.8,
                          }}
                          title={`competition_id: ${t.competition_id}`}
                        >
                          {t.competition}
                        </button>
                      );
                    })
                  )}
                </div>
                <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                  If you select none, it means “all tournaments”.
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>League update policy</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['LOCK_PER_GAMEWEEK', 'LOCK_ON_SUBMIT', 'LIVE'] as const).map((p) => {
                    const active = updatePolicy === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setUpdatePolicy(p)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 999,
                          fontWeight: 950,
                          cursor: 'pointer',
                          border: active
                            ? '1px solid rgba(255,255,255,0.5)'
                            : '1px solid rgba(255,255,255,0.14)',
                          background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                          opacity: active ? 1 : 0.8,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                  (This must match your enum values in <code>app.league_update_policy</code>.)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  if (!creating) setShowCreate(false);
                }}
                disabled={creating}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontWeight: 900,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                Cancel
              </button>

              <button
                onClick={onCreateLeague}
                disabled={creating}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontWeight: 950,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? 'Creating…' : 'Create league'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
