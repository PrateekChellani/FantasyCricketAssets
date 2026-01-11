'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type Row = {
  match_id: number;
  match_date: string | null;
  venue: string | null;
  format: string | null;
  result: string | null; // already the winning team or descriptor
  detailed_result: string | null; // "Won by X..." etc.
  match_name: string | null;
  dated_name: string | null;

  // from v_match_points_overview
  top_scorer_name: string | null;
  top_scorer_points: number | null;
  top_scorer_display: string | null; // preferred preformatted
  /** NEW: id for linking */
  top_scorer_id: number | null;
};

const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
};

const Th: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...rest }) => (
  <th style={{ ...thTdBase, fontWeight: 700, ...(style || {}) }} {...rest}>
    {children}
  </th>
);
const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...rest }) => (
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

export default function MatchPointsOverviewPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [teamFilter, setTeamFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .schema('public')
        .from('v_match_points_overview')
        .select(`
          match_id, match_date, venue, format, result, detailed_result,
          match_name, dated_name,
          top_scorer_name, top_scorer_points, top_scorer_display, top_scorer_id
        `)
        .order('match_date', { ascending: false });

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as Row[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const title = (r.match_name ?? r.dated_name ?? '').toLowerCase();
      const tf = teamFilter.trim().toLowerCase();
      const vf = venueFilter.trim().toLowerCase();
      const ff = formatFilter.trim().toLowerCase();

      const teamOk = tf === '' || title.includes(tf);
      const venueOk = vf === '' || (r.venue ?? '').toLowerCase().includes(vf);
      const formatOk = ff === '' || (r.format ?? '').toLowerCase().includes(ff);

      let dateOk = true;
      if (dateFrom) dateOk &&= (r.match_date ?? '') >= dateFrom;
      if (dateTo) dateOk &&= (r.match_date ?? '') <= dateTo;

      return teamOk && venueOk && formatOk && dateOk;
    });
  }, [rows, teamFilter, venueFilter, dateFrom, dateTo, formatFilter]);

  return (
    <div style={{ display: 'flex', minHeight: '70vh' }}>
      {/* Drawer toggle */}
      <button
        aria-label="Filters"
        onClick={() => setDrawerOpen((s) => !s)}
        style={{
          position: 'fixed',
          left: 8,
          top: 96,
          zIndex: 5,
          padding: '6px 10px',
          border: '1px solid #ddd',
          background: '#fff',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {drawerOpen ? '« Filters' : '» Filters'}
      </button>

      {/* Drawer panel */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 80,
          bottom: 0,
          zIndex: 6,

          width: drawerOpen ? 640 : 0, // expanded + overlays (consistent with other pages)
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          borderRight: drawerOpen ? '1px solid #eee' : 'none',
          padding: drawerOpen ? '16px' : 0,
          background: '#fafafa',
          boxShadow: drawerOpen ? '0 10px 30px rgba(0,0,0,0.18)' : 'none',
        }}
      >
        <div style={{ height: '100%', overflowY: 'auto' }}>
          {/* Collapse button inside panel */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              aria-label="Close filters"
              onClick={() => setDrawerOpen(false)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                background: '#fff',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              × Close
            </button>
          </div>

          <h3 style={{ marginTop: 0 }}>Filters</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Team or Match</label>
            <input
              type="text"
              placeholder="Type team or match…"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Format</label>
            <input
              type="text"
              placeholder="T20I / ODI / Test…"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Venue</label>
            <input
              type="text"
              placeholder="Type ground…"
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600 }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600 }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ marginTop: 0 }}>Match Points Breakdown</h1>
        {err ? (
          <div style={{ color: 'crimson' }}>Failed to load: {err}</div>
        ) : rows.length === 0 ? (
          <div>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Match</Th>
                  <Th>Venue</Th>
                  <Th>Format</Th>
                  <Th>Result</Th>
                  <Th>Top Point Scorer</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const id = r.match_id;
                  const resultPretty = [r.result, r.detailed_result].filter(Boolean).join(' ');

                  // Keep your preferred preformatted text if id is missing
                  const pts = r.top_scorer_points != null ? ` (${Math.round(Number(r.top_scorer_points))})` : '';

                  return (
                    <tr key={id}>
                      <Td>{prettyDate(r.match_date)}</Td>
                      <Td>{r.match_name ?? r.dated_name ?? `Match ${id}`}</Td>
                      <Td>{r.venue ?? ''}</Td>
                      <Td>{r.format ?? ''}</Td>
                      <Td>{resultPretty}</Td>
                      <Td>
                        {r.top_scorer_id && r.top_scorer_name ? (
                          <>
                            <Link href={`/players/${r.top_scorer_id}`} style={{ textDecoration: 'underline' }}>
                              {r.top_scorer_name}
                            </Link>
                            {pts}
                          </>
                        ) : (
                          r.top_scorer_display ?? ''
                        )}
                      </Td>
                      <Td>
                        <Link href={`/matches/points/${id}`} style={{ textDecoration: 'underline' }}>
                          details
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
