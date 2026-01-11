'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

/** Row shape from public.v_matches_overview */
type MatchRow = {
  match_id: number;
  match_date: string | null;
  competition: string | null;
  venue: string | null;
  format: string | null;

  match_name: string | null;
  dated_name: string | null;

  // kept (not used for filtering anymore)
  result: string | null;
  home_score: string | null;
  away_score: string | null;
};

const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
};

type ThProps = React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement> & {
  children?: React.ReactNode;
};

type TdProps = React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement> & {
  children?: React.ReactNode;
};

const Th: React.FC<ThProps> = ({ children, style, ...rest }) => (
  <th style={{ ...thTdBase, fontWeight: 700, ...(style || {}) }} {...rest}>
    {children}
  </th>
);

const Td: React.FC<TdProps> = ({ children, style, ...rest }) => (
  <td style={{ ...thTdBase, ...(style || {}) }} {...rest}>
    {children}
  </td>
);

function prettyDate(d?: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ymdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddMatchPage() {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [matchesWithAnyPmc, setMatchesWithAnyPmc] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);

      // Load matches
      const { data, error } = await supabase
        .schema('public')
        .from('v_matches_overview')
        .select('match_id, match_date, match_name, dated_name, competition, venue, format, result, home_score, away_score')
        .order('match_date', { ascending: false });

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      const matchRows = (data ?? []) as MatchRow[];
      setRows(matchRows);

      // Load which matches already have *any* player_match_connector rows
      const { data: pmcData, error: pmcErr } = await supabase
        .schema('public')
        .from('v_match_player_counts')
        .select('match_id');

      if (pmcErr) {
        setErr((prev) => (prev ? `${prev} | ${pmcErr.message}` : pmcErr.message));
        setMatchesWithAnyPmc(new Set());
        return;
      }

      const s = new Set<number>();
      for (const r of pmcData ?? []) {
        const mid = (r as any)?.match_id;
        if (typeof mid === 'number') s.add(mid);
      }
      setMatchesWithAnyPmc(s);
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = ymdLocal(tomorrow);

    return rows.filter((r) => {
      // Date filter: match_date <= tomorrow (and must have a date)
      const md = (r.match_date ?? '').slice(0, 10);
      const dateOk = md !== '' && md <= tomorrowStr;

      // NEW: only show matches with 0 rows in app.player_match_connector
      const hasAnyPmc = matchesWithAnyPmc.has(r.match_id);
      const pmcOk = !hasAnyPmc;

      return dateOk && pmcOk;
    });
  }, [rows, matchesWithAnyPmc]);

  return (
    <div style={{ display: 'flex', minHeight: '70vh' }}>
      <main style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ marginTop: 0 }}>Add a Match</h1>
        <div style={{ marginTop: 6, marginBottom: 18, opacity: 0.85 }}>
          Thank you for your effort. Below are all the completed matches still missing scorecard information.
        </div>

        {err ? (
          <div style={{ color: 'crimson' }}>Failed to load matches: {err}</div>
        ) : rows.length === 0 ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div>No matches are currently missing scorecard information.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Match</Th>
                  <Th>Competition</Th>
                  <Th>Venue</Th>
                  <Th>Format</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const id = r.match_id;
                  const matchTitle = r.match_name || r.dated_name || `Match ${id}`;

                  return (
                    <tr key={id}>
                      <Td>{prettyDate(r.match_date)}</Td>
                      <Td>{matchTitle}</Td>
                      <Td>{r.competition ?? ''}</Td>
                      <Td>{r.venue ?? ''}</Td>
                      <Td>{r.format ?? ''}</Td>
                      <Td>
                        <Link
                          href={`/add_match/${id}`}
                          style={{
                            display: 'inline-block',
                            padding: '8px 10px',
                            border: '1px solid #ddd',
                            borderRadius: 8,
                            background: '#fff',
                            textDecoration: 'none',
                            fontWeight: 700,
                          }}
                        >
                          Choose this match
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
