'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type ObjectiveRow = {
  objective_id: number;
  objective_key: string;
  name: string;
  short_name: string;
  description: string | null;
  category: 'Onboarding' | 'Featured' | 'Daily' | 'Weekly' | 'Collection';
  active: boolean;
  is_repeatable: boolean;
  cp_reward: number;
  amount_needed: number;
  tracking_type: 'COUNT' | 'SUM' | 'MAX' | 'BOOLEAN';
  filters: any;
  created_at: string;
  deactivated_at: string | null;
};

type RotationPreview = {
  rotation_type: 'DAILY' | 'WEEKLY';
  window_key: string;
  objective_ids: number[];
  objective_keys: string[];
};

type EventRow = {
  event_id: number;
  occurred_at: string;
  user_id: string;
  objective_id: number;
  objective_key: string | null;
  category: string | null;
  window_type: string;
  window_key: string | null;
  instance_key: string | null;
  event_key: string | null;
  delta_amount: number;
  progress_before: number | null;
  progress_after: number | null;
  payload: any;
};

const ADMIN_IDS = new Set([
  'bcc0b66c-9f2e-4dac-992b-dd1d1bbcdd1a',
  'f2d25d63-e8db-4683-88bd-15713e2439a1',
]);

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 14,
  padding: 16,
};

const thtd: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '10px 10px',
  textAlign: 'left',
  fontSize: 14,
  verticalAlign: 'top',
};

const head: React.CSSProperties = { background: '#fafafa' };

function Pill({ text, tone }: { text: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const t = tone ?? 'neutral';
  const bg = t === 'good' ? '#e7f8ee' : t === 'bad' ? '#ffecec' : '#f3f4f6';
  const fg = t === 'good' ? '#166534' : t === 'bad' ? '#991b1b' : '#111827';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 800,
        border: '1px solid rgba(0,0,0,0.06)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function AdminObjectivesPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [objectives, setObjectives] = useState<ObjectiveRow[]>([]);
  const [objErr, setObjErr] = useState<string | null>(null);

  const [dailyPreview, setDailyPreview] = useState<RotationPreview | null>(null);
  const [weeklyPreview, setWeeklyPreview] = useState<RotationPreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsErr, setEventsErr] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<'All' | ObjectiveRow['category']>('All');

  const [eventUserId, setEventUserId] = useState('');
  const [eventObjectiveId, setEventObjectiveId] = useState('');
  const [eventKey, setEventKey] = useState('');
  const [eventLimit, setEventLimit] = useState(200);

  async function loadObjectives() {
    setObjErr(null);
    const res = await supabase.rpc('admin_list_objectives');
    if (res.error) {
      setObjErr(res.error.message);
      setObjectives([]);
      return;
    }
    setObjectives((res.data ?? []) as ObjectiveRow[]);
  }

  async function loadPreview() {
    setPreviewErr(null);

    const [d, w] = await Promise.all([
      supabase.rpc('admin_preview_next_rotation', { p_rotation_type: 'DAILY' }),
      supabase.rpc('admin_preview_next_rotation', { p_rotation_type: 'WEEKLY' }),
    ]);

    if (d.error || w.error) {
      setPreviewErr(d.error?.message ?? w.error?.message ?? 'Failed to load preview');
      setDailyPreview(null);
      setWeeklyPreview(null);
      return;
    }

    setDailyPreview(((d.data ?? [])[0] ?? null) as RotationPreview | null);
    setWeeklyPreview(((w.data ?? [])[0] ?? null) as RotationPreview | null);
  }

  async function loadEvents() {
    setEventsErr(null);

    const p_user_id = eventUserId.trim() ? eventUserId.trim() : null;
    const p_objective_id = eventObjectiveId.trim() ? Number(eventObjectiveId.trim()) : null;
    const p_event_key = eventKey.trim() ? eventKey.trim() : null;

    const res = await supabase.rpc('admin_list_objective_events', {
      p_limit: Math.max(1, Math.min(eventLimit, 500)),
      p_offset: 0,
      p_user_id,
      p_objective_id: p_objective_id as any,
      p_event_key,
    });

    if (res.error) {
      setEventsErr(res.error.message);
      setEvents([]);
      return;
    }
    setEvents((res.data ?? []) as EventRow[]);
  }

  async function bootstrap() {
    setLoading(true);
    setObjErr(null);
    setPreviewErr(null);
    setEventsErr(null);

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const uid = data?.user?.id ?? null;
      const ok = !!uid && ADMIN_IDS.has(uid);
      setIsAdmin(ok);

      if (!ok) {
        setLoading(false);
        return;
      }

      await Promise.all([loadObjectives(), loadPreview(), loadEvents()]);
    } catch (e: any) {
      setObjErr(e?.message ?? 'Failed to initialize admin page');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredObjectives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objectives.filter((o) => {
      if (cat !== 'All' && o.category !== cat) return false;
      if (!q) return true;
      return (
        o.objective_key.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        (o.short_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [objectives, search, cat]);

  async function toggleActive(objective_id: number, next: boolean) {
    // optimistic UI
    setObjectives((prev) =>
      prev.map((o) => (o.objective_id === objective_id ? { ...o, active: next } : o))
    );

    const res = await supabase.rpc('admin_set_objective_active', {
      p_objective_id: objective_id,
      p_active: next,
    });

    if (res.error) {
      // revert if failed
      setObjectives((prev) =>
        prev.map((o) => (o.objective_id === objective_id ? { ...o, active: !next } : o))
      );
      alert(res.error.message);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ margin: 0 }}>Admin · Objectives</h1>
        <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ margin: 0 }}>Admin · Objectives</h1>
        <div style={{ ...card, marginTop: 14 }}>
          <Pill text="Not authorized" tone="bad" />
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            You don’t have admin access for this page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Admin · Objectives</h1>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Admins can only toggle Active/Inactive. Rewards/filters/amounts stay Supabase-only.
          </div>
        </div>

        <button
          onClick={() => bootstrap()}
          style={{
            border: '1px solid #e5e7eb',
            background: '#fff',
            borderRadius: 10,
            padding: '10px 12px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Preview (read-only) */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Rotation Preview (read-only)</div>
          <button
            onClick={() => loadPreview()}
            style={{
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 10,
              padding: '8px 10px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Refresh Preview
          </button>
        </div>

        {previewErr && <div style={{ color: 'crimson', marginTop: 10 }}>{previewErr}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={{ ...card, background: '#fcfcfc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 900 }}>Next Daily</div>
              <Pill text={dailyPreview?.window_key ?? '—'} />
            </div>

            <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
              {(dailyPreview?.objective_keys ?? []).length ? (
                (dailyPreview?.objective_keys ?? []).map((k) => (
                  <div key={k} style={{ marginTop: 6 }}>
                    • <code style={{ fontSize: 12 }}>{k}</code>
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.75 }}>No active Daily objectives to choose from.</div>
              )}
            </div>
          </div>

          <div style={{ ...card, background: '#fcfcfc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 900 }}>Next Weekly</div>
              <Pill text={weeklyPreview?.window_key ?? '—'} />
            </div>

            <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
              {(weeklyPreview?.objective_keys ?? []).length ? (
                (weeklyPreview?.objective_keys ?? []).map((k) => (
                  <div key={k} style={{ marginTop: 6 }}>
                    • <code style={{ fontSize: 12 }}>{k}</code>
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.75 }}>No active Weekly objectives to choose from.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Objectives */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>All Objectives</div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as any)}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '8px 10px',
                background: '#fff',
                fontWeight: 800,
              }}
            >
              <option value="All">All Categories</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Featured">Featured</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Collection">Collection</option>
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or key…"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '8px 10px',
                width: 260,
              }}
            />
          </div>
        </div>

        {objErr && <div style={{ color: 'crimson', marginTop: 10 }}>{objErr}</div>}

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead style={head}>
              <tr>
                <th style={thtd}>ID</th>
                <th style={thtd}>Category</th>
                <th style={thtd}>Objective</th>
                <th style={thtd}>Key</th>
                <th style={thtd}>Active</th>
                <th style={thtd}>Needed</th>
                <th style={thtd}>Tracking</th>
                <th style={thtd}>Reward</th>
                <th style={thtd}>Filters</th>
              </tr>
            </thead>
            <tbody>
              {filteredObjectives.map((o) => (
                <tr key={o.objective_id} style={{ opacity: o.active ? 1 : 0.65 }}>
                  <td style={thtd}>{o.objective_id}</td>
                  <td style={thtd}>
                    <Pill text={o.category} />
                  </td>
                  <td style={thtd}>
                    <div style={{ fontWeight: 950 }}>{o.name}</div>
                    <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                      {o.description ?? o.short_name}
                    </div>
                  </td>
                  <td style={thtd}>
                    <code style={{ fontSize: 12 }}>{o.objective_key}</code>
                  </td>
                  <td style={thtd}>
                    <label style={{ display: 'inline-flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!o.active}
                        onChange={(e) => toggleActive(o.objective_id, e.target.checked)}
                      />
                      {o.active ? <Pill text="Active" tone="good" /> : <Pill text="Inactive" tone="bad" />}
                    </label>
                  </td>
                  <td style={thtd}>{o.amount_needed}</td>
                  <td style={thtd}>{o.tracking_type}</td>
                  <td style={thtd}>{o.cp_reward}</td>
                  <td style={thtd}>
                    <details>
                      <summary style={{ cursor: 'pointer', fontWeight: 900 }}>View</summary>
                      <pre
                        style={{
                          marginTop: 10,
                          background: '#0b1020',
                          color: '#e5e7eb',
                          padding: 12,
                          borderRadius: 12,
                          overflowX: 'auto',
                          fontSize: 12,
                          lineHeight: 1.35,
                        }}
                      >
                        {JSON.stringify(o.filters ?? {}, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}

              {!filteredObjectives.length && (
                <tr>
                  <td style={thtd} colSpan={9}>
                    &mdash; No objectives match your filters &mdash;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Trail */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Objective Event Trail</div>

          <button
            onClick={() => loadEvents()}
            style={{
              marginLeft: 'auto',
              border: '1px solid #e5e7eb',
              background: '#fff',
              borderRadius: 10,
              padding: '8px 10px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Refresh Events
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <input
            value={eventUserId}
            onChange={(e) => setEventUserId(e.target.value)}
            placeholder="Filter user_id (optional)"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', width: 320 }}
          />
          <input
            value={eventObjectiveId}
            onChange={(e) => setEventObjectiveId(e.target.value)}
            placeholder="Filter objective_id (optional)"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', width: 220 }}
          />
          <input
            value={eventKey}
            onChange={(e) => setEventKey(e.target.value)}
            placeholder="Filter event_key (optional)"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', width: 220 }}
          />
          <input
            value={eventLimit}
            onChange={(e) => setEventLimit(Number(e.target.value || 200))}
            type="number"
            min={1}
            max={500}
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', width: 120 }}
          />
        </div>

        {eventsErr && <div style={{ color: 'crimson', marginTop: 10 }}>{eventsErr}</div>}

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead style={head}>
              <tr>
                <th style={thtd}>When</th>
                <th style={thtd}>User</th>
                <th style={thtd}>Objective</th>
                <th style={thtd}>Window</th>
                <th style={thtd}>Event</th>
                <th style={thtd}>Δ</th>
                <th style={thtd}>Progress</th>
                <th style={thtd}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id}>
                  <td style={thtd}>{fmt(e.occurred_at)}</td>
                  <td style={thtd}>
                    <code style={{ fontSize: 12 }}>{e.user_id}</code>
                  </td>
                  <td style={thtd}>
                    <div style={{ fontWeight: 950 }}>
                      {e.objective_key ?? `objective_id=${e.objective_id}`}
                    </div>
                    <div style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
                      {e.category ? <Pill text={e.category} /> : null}
                    </div>
                  </td>
                  <td style={thtd}>
                    <div style={{ fontWeight: 900 }}>{e.window_type}</div>
                    <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                      {e.window_key ?? '—'}
                    </div>
                  </td>
                  <td style={thtd}>
                    <code style={{ fontSize: 12 }}>{e.event_key ?? '—'}</code>
                  </td>
                  <td style={thtd}>{e.delta_amount}</td>
                  <td style={thtd}>
                    {e.progress_before ?? '—'} → {e.progress_after ?? '—'}
                  </td>
                  <td style={thtd}>
                    <details>
                      <summary style={{ cursor: 'pointer', fontWeight: 900 }}>View</summary>
                      <pre
                        style={{
                          marginTop: 10,
                          background: '#0b1020',
                          color: '#e5e7eb',
                          padding: 12,
                          borderRadius: 12,
                          overflowX: 'auto',
                          fontSize: 12,
                          lineHeight: 1.35,
                        }}
                      >
                        {JSON.stringify(e.payload ?? {}, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}

              {!events.length && (
                <tr>
                  <td style={thtd} colSpan={8}>
                    &mdash; No events found &mdash;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Tip: event trail fills when your app calls <code>record_objective_event</code>.
      </div>
    </div>
  );
}
