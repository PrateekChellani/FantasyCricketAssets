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
  result: string | null; // e.g., "India"
  detailed_result: string | null; // e.g., "Won by 5 wickets…"
  match_name: string | null; // e.g., "IND vs PAK, Asia Cup Match 19"
  dated_name: string | null; // fallback if needed
  man_of_the_match: string | null;
  /** NEW: id for linking */
  man_of_the_match_player_id: number | null;
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

export default function MatchesPage() {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [teamFilter, setTeamFilter] = useState(''); // searches in match_name
  const [compFilter, setCompFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState(''); // NEW
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .schema('public')
        .from('v_matches_overview')
        .select(
          // NEW: man_of_the_match_player_id included
          'match_id, match_date, competition, venue, format, result, detailed_result, match_name, dated_name, man_of_the_match, man_of_the_match_player_id'
        )
        .order('match_date', { ascending: false });

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as MatchRow[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchTitle = (r.match_name || r.dated_name || '').toLowerCase();

      const teamOk = teamFilter.trim() === '' || matchTitle.includes(teamFilter.toLowerCase());

      const compOk =
        compFilter.trim() === '' || (r.competition ?? '').toLowerCase().includes(compFilter.toLowerCase());

      const venueOk =
        venueFilter.trim() === '' || (r.venue ?? '').toLowerCase().includes(venueFilter.toLowerCase());

      const formatOk =
        formatFilter.trim() === '' || (r.format ?? '').toLowerCase().includes(formatFilter.toLowerCase());

      // Date range (client-side)
      let dateOk = true;
      if (dateFrom) dateOk &&= (r.match_date ?? '') >= dateFrom;
      if (dateTo) dateOk &&= (r.match_date ?? '') <= dateTo;

      return teamOk && compOk && venueOk && formatOk && dateOk;
    });
  }, [rows, teamFilter, compFilter, venueFilter, formatFilter, dateFrom, dateTo]);

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
            <label style={{ display: 'block', fontWeight: 600 }}>Team</label>
            <input
              type="text"
              placeholder="Type team name…"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>(Searches in the match title)</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Competition</label>
            <input
              type="text"
              placeholder="Type competition…"
              value={compFilter}
              onChange={(e) => setCompFilter(e.target.value)}
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

          {/* NEW: Format filter */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600 }}>Format</label>
            <input
              type="text"
              placeholder="e.g., T20I, ODI, Test…"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
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

      {/* Main table */}
      <main style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ marginTop: 0 }}>Matches</h1>
        {err ? (
          <div style={{ color: 'crimson' }}>Failed to load matches: {err}</div>
        ) : rows.length === 0 ? (
          <div>Loading…</div>
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
                  <Th>Result</Th>
                  <Th>Man of the Match</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const id = r.match_id;
                  const matchTitle = r.match_name || r.dated_name || `Match ${id}`;
                  const displayResult = [r.result, r.detailed_result].filter(Boolean).join(' ');

                  return (
                    <tr key={id}>
                      <Td>{prettyDate(r.match_date)}</Td>
                      <Td>{matchTitle}</Td>
                      <Td>{r.competition ?? ''}</Td>
                      <Td>{r.venue ?? ''}</Td>
                      <Td>{r.format ?? ''}</Td>
                      <Td>{displayResult}</Td>
                      <Td>
                        {r.man_of_the_match_player_id ? (
                          <Link href={`/players/${r.man_of_the_match_player_id}`} style={{ textDecoration: 'underline' }}>
                            {r.man_of_the_match ?? ''}
                          </Link>
                        ) : (
                          r.man_of_the_match ?? ''
                        )}
                      </Td>
                      <Td>
                        <Link href={`/matches/${id}`} style={{ textDecoration: 'underline' }}>
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
