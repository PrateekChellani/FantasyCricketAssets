'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient';

type ObjectiveCategory = 'Onboarding' | 'Featured' | 'Daily' | 'Weekly' | 'Collection';

type ObjRow = {
  objective_id: number;
  objective_key: string;
  name: string;
  short_name: string;
  description: string | null;
  category: ObjectiveCategory;

  window_type: 'LIFETIME' | 'DAILY' | 'WEEKLY';
  window_key: string | null;

  expires_at: string | null;

  amount_needed: number;
  tracking_type: 'COUNT' | 'SUM' | 'MAX' | 'BOOLEAN';
  is_repeatable: boolean;
  cp_reward: number;

  progress_amount: number;
  completed_at: string | null;
  cp_awarded_at: string | null;
  last_event_at: string | null;
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
};

const cpIcon = 'https://fantasy-cricket-assets.vercel.app/assets/cp.png';

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function categoryLabel(cat: ObjectiveCategory) {
  if (cat === 'Onboarding') return 'Foundation';
  return cat;
}

function categoryOrder(cat: ObjectiveCategory) {
  const order: ObjectiveCategory[] = ['Onboarding', 'Featured', 'Daily', 'Weekly', 'Collection'];
  return order.indexOf(cat);
}

function isCompleted(r: ObjRow) {
  return !!r.completed_at || (r.progress_amount ?? 0) >= (r.amount_needed ?? 1);
}

function dedupe(rows: ObjRow[]) {
  const m = new Map<string, ObjRow>();

  const keyOf = (r: ObjRow) => `${r.objective_id}|${r.window_type}|${r.window_key ?? ''}`;
  const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);

  for (const r of rows) {
    const k = keyOf(r);
    const prev = m.get(k);
    if (!prev) {
      m.set(k, r);
      continue;
    }

    const prevDone = isCompleted(prev);
    const curDone = isCompleted(r);

    const prevProgress = prev.progress_amount ?? 0;
    const curProgress = r.progress_amount ?? 0;

    const prevRecency = Math.max(ts(prev.last_event_at), ts(prev.completed_at));
    const curRecency = Math.max(ts(r.last_event_at), ts(r.completed_at));

    const shouldReplace =
      (curDone && !prevDone) ||
      (curDone === prevDone && curProgress > prevProgress) ||
      (curDone === prevDone && curProgress === prevProgress && curRecency > prevRecency);

    if (shouldReplace) m.set(k, r);
  }

  return Array.from(m.values());
}

function SkeletonCategory({ title, open }: { title: string; open: boolean }) {
  return (
    <div style={{ ...card, marginTop: 14 }}>
      <details open={open}>
        <summary
          style={{
            cursor: 'pointer',
            listStyle: 'none',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ height: 20, width: 140, borderRadius: 999, background: '#eee' }} />
            <div style={{ height: 20, width: 70, borderRadius: 999, background: '#eee' }} />
          </div>
        </summary>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 12,
                padding: 14,
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 16, width: '55%', background: '#eaeaea', borderRadius: 8 }} />
                  <div style={{ height: 12, width: '70%', background: '#efefef', borderRadius: 8, marginTop: 10 }} />
                </div>
                <div style={{ height: 14, width: 64, background: '#eaeaea', borderRadius: 999 }} />
              </div>
              <div style={{ height: 8, width: '100%', background: '#eaeaea', borderRadius: 999, marginTop: 12 }} />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function HomePage() {
  const [rows, setRows] = useState<ObjRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const prevCompletedKeysRef = useRef<Set<string>>(new Set());
  const [pulseKeys, setPulseKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await supabase.rpc('get_my_active_objectives');
        if (res.error) throw res.error;

        const raw = (res.data ?? []) as ObjRow[];
        setRows(dedupe(raw));
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load objectives');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const cats: ObjectiveCategory[] = ['Onboarding', 'Featured', 'Daily', 'Weekly', 'Collection'];
    const map = new Map<ObjectiveCategory, ObjRow[]>();
    for (const c of cats) map.set(c, []);

    for (const r of rows) {
      const c = r.category;
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(r);
    }

    for (const c of cats) {
      const arr = map.get(c)!;
      arr.sort((a, b) => {
        const ad = isCompleted(a) ? 1 : 0;
        const bd = isCompleted(b) ? 1 : 0;
        if (ad !== bd) return ad - bd;

        const ap = a.progress_amount ?? 0;
        const bp = b.progress_amount ?? 0;
        if (bp !== ap) return bp - ap;

        return (a.short_name ?? a.name).localeCompare(b.short_name ?? b.name);
      });
    }

    return map;
  }, [rows]);

  const headerMeta = useMemo(() => {
    const out: Record<ObjectiveCategory, { total: number; done: number; expiresAtMs: number | null }> = {
      Onboarding: { total: 0, done: 0, expiresAtMs: null },
      Featured: { total: 0, done: 0, expiresAtMs: null },
      Daily: { total: 0, done: 0, expiresAtMs: null },
      Weekly: { total: 0, done: 0, expiresAtMs: null },
      Collection: { total: 0, done: 0, expiresAtMs: null },
    };

    (Object.keys(out) as ObjectiveCategory[]).forEach((cat) => {
      const list = grouped.get(cat) ?? [];
      out[cat].total = list.length;
      out[cat].done = list.filter(isCompleted).length;

      const expires = list
        .map((r) => (r.expires_at ? new Date(r.expires_at).getTime() : null))
        .filter((x): x is number => typeof x === 'number');

      out[cat].expiresAtMs = expires.length ? Math.max(...expires) : null;
    });

    return out;
  }, [grouped]);

  useEffect(() => {
    const keyOf = (r: ObjRow) => `${r.objective_id}|${r.window_type}|${r.window_key ?? ''}`;

    const prev = prevCompletedKeysRef.current;
    const nowCompleted = new Set<string>();

    for (const r of rows) if (isCompleted(r)) nowCompleted.add(keyOf(r));

    const newlyCompleted: string[] = [];
    for (const k of nowCompleted) if (!prev.has(k)) newlyCompleted.push(k);

    if (newlyCompleted.length) {
      setPulseKeys((old) => {
        const next = new Set(old);
        for (const k of newlyCompleted) next.add(k);
        return next;
      });

      window.setTimeout(() => {
        setPulseKeys((old) => {
          const next = new Set(old);
          for (const k of newlyCompleted) next.delete(k);
          return next;
        });
      }, 650);
    }

    prevCompletedKeysRef.current = nowCompleted;
  }, [rows]);

  const categories: ObjectiveCategory[] = ['Onboarding', 'Featured', 'Daily', 'Weekly', 'Collection'];
  const defaultOpen = (cat: ObjectiveCategory) => cat === 'Daily' || cat === 'Weekly';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Home</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>Objectives</h2>
      </div>

      {err && <div style={{ color: 'crimson', marginTop: 10 }}>{err}</div>}

      {loading ? (
        <>
          <SkeletonCategory title="Foundation" open={false} />
          <SkeletonCategory title="Featured" open={false} />
          <SkeletonCategory title="Daily" open />
          <SkeletonCategory title="Weekly" open />
          <SkeletonCategory title="Collection" open={false} />
        </>
      ) : (
        categories
          .slice()
          .sort((a, b) => categoryOrder(a) - categoryOrder(b))
          .map((cat) => {
            const list = grouped.get(cat) ?? [];
            const meta = headerMeta[cat];
            const label = categoryLabel(cat);

            const expiresMs = meta.expiresAtMs;
            const countdown =
              (cat === 'Daily' || cat === 'Weekly') && expiresMs != null
                ? formatCountdown(expiresMs - nowTick)
                : null;

            return (
              <div key={cat} style={{ ...card, marginTop: 14 }}>
                <details open={defaultOpen(cat)}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      listStyle: 'none',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{label}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {countdown && (
                        <div
                          style={{
                            fontSize: 14,
                            padding: '8px 12px',
                            borderRadius: 999,
                            background: '#f6f7f9',
                            border: '1px solid #eee',
                            whiteSpace: 'nowrap',
                            fontWeight: 800,
                          }}
                          title={
                            cat === 'Daily'
                              ? 'Daily refresh at 11:59:59 PM IST'
                              : 'Weekly refresh Saturday 11:59:59 PM IST'
                          }
                        >
                          ⏳ {countdown}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 13,
                          padding: '7px 12px',
                          borderRadius: 999,
                          background: '#f6f7f9',
                          border: '1px solid #eee',
                          whiteSpace: 'nowrap',
                          fontWeight: 900,
                        }}
                      >
                        {meta.total === 0 ? '—' : `${meta.done}/${meta.total}`}
                      </div>
                    </div>
                  </summary>

                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    {list.length === 0 ? (
                      <div style={{ opacity: 0.7, padding: 12, border: '1px dashed #e6e6e6', borderRadius: 12 }}>
                        No {label} objectives available.
                      </div>
                    ) : (
                      list.map((r) => {
                        const done = isCompleted(r);
                        const need = Math.max(1, r.amount_needed ?? 1);
                        const prog = clamp(r.progress_amount ?? 0, 0, need);
                        const pct = Math.round((prog / need) * 100);

                        const key = `${r.objective_id}|${r.window_type}|${r.window_key ?? ''}`;
                        const shouldPulse = pulseKeys.has(key);

                        return (
                          <div
                            key={key}
                            style={{
                              border: '1px solid #f0f0f0',
                              borderRadius: 12,
                              padding: 14,
                              background: done ? '#eafff0' : '#fff',
                              transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease',
                              boxShadow: shouldPulse ? '0 8px 24px rgba(0,0,0,0.10)' : '0 0 0 rgba(0,0,0,0)',
                              transform: shouldPulse ? 'scale(1.01)' : 'scale(1)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: 16, fontWeight: 900 }}>{r.short_name || r.name}</div>

                                  {done && (
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                        background: '#d9ffe4',
                                        border: '1px solid #c7f6d3',
                                        fontSize: 12,
                                        fontWeight: 800,
                                      }}
                                    >
                                      ✅ Completed
                                    </div>
                                  )}
                                </div>

                                {r.description && (
                                  <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{r.description}</div>
                                )}
                              </div>

                              {/* Right-side stats: CP reward + Progress */}
                              <div style={{ textAlign: 'right', minWidth: 110 }}>
                                {r.cp_reward > 0 && (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      justifyContent: 'flex-end',
                                      marginBottom: 6,
                                    }}
                                  >
                                    <img
                                      src={cpIcon}
                                      alt="CP"
                                      width={16}
                                      height={16}
                                      style={{ display: 'block' }}
                                    />
                                    <div style={{ fontSize: 14, fontWeight: 900 }}>{r.cp_reward}</div>
                                  </div>
                                )}

                                <div style={{ fontSize: 12, opacity: 0.7 }}>Progress</div>
                                <div style={{ fontSize: 14, fontWeight: 900 }}>
                                  {done ? `${need}/${need}` : `${prog}/${need}`}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                height: 10,
                                borderRadius: 999,
                                background: '#efefef',
                                overflow: 'hidden',
                                marginTop: 12,
                                border: '1px solid #e9e9e9',
                              }}
                              aria-label={`${r.short_name || r.name} progress bar`}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${done ? 100 : pct}%`,
                                  background: done ? '#22c55e' : '#111',
                                  borderRadius: 999,
                                  transition: 'width 380ms ease',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
              </div>
            );
          })
      )}
    </div>
  );
}
