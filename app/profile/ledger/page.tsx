'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ------------ tiny styles ------------
const wrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, maxWidth: 420 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#f7f7f7', cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { ...btn, background: '#111', color: '#fff', borderColor: '#111' };
const thtd: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 10px', textAlign: 'left', fontSize: 14, verticalAlign: 'top' };
const thead: React.CSSProperties = { background: '#fafafa' };

// ------------ helpers ------------
function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function oneYearAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 365);
  return yyyyMmDd(d);
}
function fmtDate(v: any) {
  if (!v) return '—';
  const dt = new Date(v);
  if (isNaN(dt.getTime())) return String(v);
  return dt.toLocaleString();
}
function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type SortKey = 'date' | 'amount' | 'new_balance';
type SortDir = 'asc' | 'desc';

// ------------ component ------------
export default function ProfileLedgerPage() {
  // Only filters: From / To (default last 1 year)
  const [dateFrom, setDateFrom] = useState(oneYearAgoStr());
  const [dateTo, setDateTo] = useState('');

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sorting (default newest -> oldest)
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(k: SortKey) {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir(k === 'date' ? 'desc' : 'asc'); // date defaults to desc; others start asc
      return;
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  function sortArrow(k: SortKey) {
    if (sortKey !== k) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  // Load only current user's transactions from PUBLIC view
  async function load() {
    setBusy(true);
    setErr(null);
    try {
      // get signed-in user id
      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const uid = userRes.user?.id;
      if (!uid) {
        setRows([]);
        setErr('You must be signed in to view your transactions.');
        return;
      }

      // Pull from public wrapper view and filter by uid client-side
      const { data, error } = await supabase.schema('public').from('v_cp_transactions').select('*');
      if (error) throw error;

      const all = (data ?? []) as any[];
      const byMe = all.filter((r) => String(r?.user_id ?? '') === uid);

      setRows(byMe);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load CP transactions');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Normalize to the exact fields you want, apply date filter + sorting
  const normalized = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const canon = rows.map((r) => {
      const created_at = r?.created_at;
      const cp_amount = num(r?.cp_amount, 0);
      const balance_before = r?.balance_before;
      const balance_after = r?.balance_after;
      const notes = r?.notes;
      return { created_at, cp_amount, balance_before, balance_after, notes };
    });

    const filtered = canon.filter((r) => {
      if (!from && !to) return true;
      if (!r.created_at) return false;
      const dt = new Date(r.created_at as any);
      if (isNaN(dt.getTime())) return false;
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      if (sortKey === 'date') {
        const ta = new Date(a.created_at as any).getTime() || 0;
        const tb = new Date(b.created_at as any).getTime() || 0;
        return (ta - tb) * dir;
      }

      if (sortKey === 'amount') {
        return (num(a.cp_amount) - num(b.cp_amount)) * dir;
      }

      // new_balance
      return (num(a.balance_after, -Infinity) - num(b.balance_after, -Infinity)) * dir;
    });

    return filtered;
  }, [rows, dateFrom, dateTo, sortKey, sortDir]);

  const totals = useMemo(() => normalized.reduce((a, b) => a + num(b.cp_amount, 0), 0), [normalized]);

  return (
    <div style={wrap}>
      <h1 style={{ marginTop: 0, textAlign: 'center' }}>Cover Points Ledger</h1>

      <div style={card}>
        <div style={grid2}>
          <div>
            <label style={{ fontWeight: 600 }}>From</label>
            <input type="date" style={input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>To</label>
            <input type="date" style={input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={primaryBtn} onClick={load} disabled={busy}>
            {busy ? 'Loading…' : 'Refresh'}
          </button>
          <button
            style={btn}
            onClick={() => {
              setDateFrom(oneYearAgoStr());
              setDateTo('');
            }}
          >
            Reset Dates
          </button>
          <div style={{ marginLeft: 'auto', opacity: 0.8 }}>
            Showing: {normalized.length} • Net Earnings: {totals}
          </div>
        </div>

        {err && <div style={{ color: 'crimson', marginTop: 10 }}>{err}</div>}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead style={thead}>
              <tr>
                <th
                  style={{ ...thtd, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('date')}
                  title="Sort by date"
                >
                  Transaction date{sortArrow('date')}
                </th>
                <th
                  style={{ ...thtd, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('amount')}
                  title="Sort by amount"
                >
                  Amount{sortArrow('amount')}
                </th>
                <th style={thtd}>Previous Balance</th>
                <th
                  style={{ ...thtd, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('new_balance')}
                  title="Sort by new balance"
                >
                  New balance{sortArrow('new_balance')}
                </th>
                <th style={thtd}>Note</th>
              </tr>
            </thead>
            <tbody>
              {normalized.map((r, i) => (
                <tr key={`${r.created_at ?? i}-${i}`}>
                  <td style={thtd}>{fmtDate(r.created_at)}</td>
                  <td style={{ ...thtd, fontWeight: 700 }}>{num(r.cp_amount, 0)}</td>
                  <td style={thtd}>{r.balance_before ?? '—'}</td>
                  <td style={thtd}>{r.balance_after ?? '—'}</td>
                  <td style={thtd} title={r.notes ?? ''}>
                    {r.notes ?? '—'}
                  </td>
                </tr>
              ))}
              {normalized.length === 0 && (
                <tr>
                  <td style={thtd} colSpan={5}>
                    — No transactions matched —
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td style={thtd}>
                  <strong>Totals</strong>
                </td>
                <td style={{ ...thtd, fontWeight: 700 }}>{totals}</td>
                <td style={thtd} colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
