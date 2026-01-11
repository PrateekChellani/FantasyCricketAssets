'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type FormatRow = { format: string; model_id: number; active: boolean };

type UnitRow = {
  model_id: number;
  stat_key: string;
  points_per_unit: number | null;
  description: string | null;
  category: string | null;
  active: boolean;
};

type BandRow = {
  model_id: number;
  stat_key: string;
  min_incl: number | null;
  max_excl: number | null;
  points: number | null;
  description: string | null;
  active: boolean;
};

// ---- Human-readable labels ----
const LABEL_OVERRIDES: Record<string, string> = {
  sr: 'Strike Rate',
  strike_rate: 'Strike Rate',
  er: 'Economy Rate',
  economy_rate: 'Economy Rate',
  dot_balls: 'Dot Balls',
  dots_bowled_blocks4: 'Dot Balls (per 4)',
  not_out_batter: 'Not Out (Batter)',
  man_of_the_match: 'Player of the Match',
};

function prettyLabel(key: string): string {
  const lk = key.toLowerCase();
  if (LABEL_OVERRIDES[lk]) return LABEL_OVERRIDES[lk];
  return lk
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Category order for the units table (used for default sorting only)
const CATEGORY_ORDER: Record<string, number> = {
  Batting: 1,
  Bowling: 2,
  Fielding: 3,
  Misc: 4,
  Miscellaneous: 4,
};

// One-liners shown above each band table (no eligibility text)
const BAND_BLURB: Record<string, string> = {
  strike_rate: 'Bonus/penalty points awarded based on the batter’s final Strike Rate.',
  sr: 'Bonus/penalty points awarded based on the batter’s final Strike Rate.',
  economy_rate: 'Bonus/penalty points awarded based on the bowler’s final Economy Rate.',
  er: 'Bonus/penalty points awarded based on the bowler’s final Economy Rate.',
  runs_scored: 'Milestone bonuses are awarded once per player per innings (highest threshold only).',
  wickets_taken: 'Milestone bonuses are awarded once per player per innings (highest threshold only).',
};

const RATE_KEYS = new Set(['sr', 'strike_rate', 'er', 'economy_rate']);
const MILESTONE_KEYS = new Set(['runs_scored', 'wickets_taken']);

type SortDir = 'asc' | 'desc';
type UnitsSortKey = 'category' | 'criteria' | 'points';
type BandsSortKey = 'range' | 'points';

export default function ScoringMatrixPage() {
  const [formats, setFormats] = useState<FormatRow[] | null>(null);
  const [formatsError, setFormatsError] = useState<string | null>(null);

  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [bands, setBands] = useState<BandRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Sorting state
  const [unitsSort, setUnitsSort] = useState<{ key: UnitsSortKey; dir: SortDir } | null>(null);
  const [bandsSortByKey, setBandsSortByKey] = useState<Record<string, { key: BandsSortKey; dir: SortDir }>>({});

  // Load available formats (ACTIVE only)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('v_formats')
        .select('format, model_id, active')
        .eq('active', true)
        .order('format', { ascending: true });

      if (error) {
        setFormatsError(error.message ?? 'Failed to load formats');
        return;
      }

      const activeFormats = (data ?? []).filter((f: any) => f.active === true);
      setFormats(activeFormats);

      if (activeFormats.length > 0) setSelectedModelId(activeFormats[0].model_id);
    })();
  }, []);

  // Load units + bands when a model is chosen
  useEffect(() => {
    if (!selectedModelId) return;
    (async () => {
      setLoadErr(null);

      const [{ data: unitsData, error: unitsErr }, { data: bandsData, error: bandsErr }] =
        await Promise.all([
          supabase
            .from('v_scoring_units')
            .select('model_id, stat_key, points_per_unit, description, category, active')
            .eq('model_id', selectedModelId)
            .eq('active', true),
          supabase
            .from('v_scoring_bands')
            .select('model_id, stat_key, min_incl, max_excl, points, description, active')
            .eq('model_id', selectedModelId)
            .eq('active', true),
        ]);

      if (unitsErr || bandsErr) {
        setLoadErr(unitsErr?.message ?? bandsErr?.message ?? 'Failed to load data');
        setUnits(null);
        setBands(null);
        return;
      }

      setUnits(unitsData ?? []);
      setBands(bandsData ?? []);
    })();
  }, [selectedModelId]);

  // Default (previous) sort for Units: category order, then points asc, then label
  const defaultSortedUnits = useMemo(() => {
    const arr = [...(units ?? [])];
    arr.sort((a, b) => {
      const catA = (a.category ?? 'Misc').trim();
      const catB = (b.category ?? 'Misc').trim();

      const orderA = CATEGORY_ORDER[catA] ?? CATEGORY_ORDER.Misc;
      const orderB = CATEGORY_ORDER[catB] ?? CATEGORY_ORDER.Misc;
      if (orderA !== orderB) return orderA - orderB;

      const pa = a.points_per_unit ?? Number.POSITIVE_INFINITY;
      const pb = b.points_per_unit ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;

      return prettyLabel(a.stat_key).localeCompare(prettyLabel(b.stat_key));
    });
    return arr;
  }, [units]);

  // Units sortable
  const sortedUnits = useMemo(() => {
    const base = [...defaultSortedUnits];
    if (!unitsSort) return base;

    const dirMult = unitsSort.dir === 'asc' ? 1 : -1;

    base.sort((a, b) => {
      if (unitsSort.key === 'category') {
        const ca = (a.category ?? 'Misc').trim().toLowerCase();
        const cb = (b.category ?? 'Misc').trim().toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb) * dirMult;
        // tie-breakers
        const la = prettyLabel(a.stat_key);
        const lb = prettyLabel(b.stat_key);
        if (la !== lb) return la.localeCompare(lb) * dirMult;
        return ((a.points_per_unit ?? 0) - (b.points_per_unit ?? 0)) * dirMult;
      }

      if (unitsSort.key === 'criteria') {
        const la = prettyLabel(a.stat_key);
        const lb = prettyLabel(b.stat_key);
        if (la !== lb) return la.localeCompare(lb) * dirMult;
        // tie-breakers
        const ca = (a.category ?? 'Misc').trim().toLowerCase();
        const cb = (b.category ?? 'Misc').trim().toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb) * dirMult;
        return ((a.points_per_unit ?? 0) - (b.points_per_unit ?? 0)) * dirMult;
      }

      // points
      const pa = a.points_per_unit ?? Number.NEGATIVE_INFINITY;
      const pb = b.points_per_unit ?? Number.NEGATIVE_INFINITY;
      if (pa !== pb) return (pa - pb) * dirMult;
      // tie-breakers
      const la = prettyLabel(a.stat_key);
      const lb = prettyLabel(b.stat_key);
      if (la !== lb) return la.localeCompare(lb) * dirMult;
      const ca = (a.category ?? 'Misc').trim().toLowerCase();
      const cb = (b.category ?? 'Misc').trim().toLowerCase();
      return ca.localeCompare(cb) * dirMult;
    });

    return base;
  }, [defaultSortedUnits, unitsSort]);

  function toggleUnitsSort(key: UnitsSortKey) {
    setUnitsSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  // Group bands by stat_key to get one table per key
  const bandsByKey = useMemo(() => {
    const map = new Map<string, BandRow[]>();
    for (const row of bands ?? []) {
      if (!map.has(row.stat_key)) map.set(row.stat_key, []);
      map.get(row.stat_key)!.push(row);
    }
    return map;
  }, [bands]);

  function toggleBandsSort(statKey: string, key: BandsSortKey) {
    setBandsSortByKey((prev) => {
      const current = prev[statKey];
      if (!current || current.key !== key) return { ...prev, [statKey]: { key, dir: 'asc' } };
      return { ...prev, [statKey]: { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } };
    });
  }

  function sortBandsForKey(statKey: string, rows: BandRow[]) {
    const sortState = bandsSortByKey[statKey] ?? { key: 'range' as BandsSortKey, dir: 'asc' as SortDir };
    const dirMult = sortState.dir === 'asc' ? 1 : -1;

    const arr = [...rows];
    arr.sort((a, b) => {
      const aMin = a.min_incl ?? Number.NEGATIVE_INFINITY;
      const bMin = b.min_incl ?? Number.NEGATIVE_INFINITY;
      const aMax = a.max_excl ?? Number.POSITIVE_INFINITY;
      const bMax = b.max_excl ?? Number.POSITIVE_INFINITY;

      if (sortState.key === 'points') {
        const ap = a.points ?? Number.NEGATIVE_INFINITY;
        const bp = b.points ?? Number.NEGATIVE_INFINITY;
        if (ap !== bp) return (ap - bp) * dirMult;

        // tie-breaker: range
        if (aMin !== bMin) return (aMin - bMin) * dirMult;
        if (aMax !== bMax) return (aMax - bMax) * dirMult;
        return 0;
      }

      // range / milestone sorting
      if (aMin !== bMin) return (aMin - bMin) * dirMult;
      if (aMax !== bMax) return (aMax - bMax) * dirMult;

      // tie-breaker: points
      const ap = a.points ?? 0;
      const bp = b.points ?? 0;
      if (ap !== bp) return (ap - bp) * dirMult;

      return 0;
    });

    return { rows: arr, sortState };
  }

  const visibleFormats = useMemo(() => (formats ?? []).filter((f) => f.active), [formats]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Scoring Matrix</h1>
      <p style={{ marginTop: 8 }}>
        Our scoring adapts to each format so performance is valued fairly across the game. Choose a format below to
        see its scoring model. Per-unit values (e.g., points per run, wicket, or dot ball) appear first, followed by
        tiered band rules grouped by statistic.
      </p>

      {/* Format selector */}
      <div style={{ marginTop: 24 }}>
        <label htmlFor="formatSel" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Select Format
        </label>
        {formatsError ? (
          <div style={{ color: 'crimson' }}>Failed to load formats: {formatsError}</div>
        ) : (
          <select
            id="formatSel"
            value={selectedModelId ?? ''}
            onChange={(e) => setSelectedModelId(Number(e.target.value))}
            style={{ padding: '0.5rem', minWidth: 240 }}
          >
            {visibleFormats.map((f) => (
              <option key={f.model_id} value={f.model_id}>
                {f.format}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Units */}
      <div style={{ marginTop: 32 }}>
        <h2>Per-Unit Criteria</h2>
        <p style={{ marginTop: 6, marginBottom: 12 }}>These award points per run, wicket, dot ball, etc.</p>

        {loadErr ? (
          <div style={{ color: 'crimson' }}>{loadErr}</div>
        ) : !sortedUnits ? (
          <div>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th sortable onClick={() => toggleUnitsSort('category')} activeKey={unitsSort?.key === 'category'} dir={unitsSort?.dir}>
                    Category
                  </Th>
                  <Th sortable onClick={() => toggleUnitsSort('criteria')} activeKey={unitsSort?.key === 'criteria'} dir={unitsSort?.dir}>
                    Criteria
                  </Th>
                  <Th sortable onClick={() => toggleUnitsSort('points')} activeKey={unitsSort?.key === 'points'} dir={unitsSort?.dir}>
                    Points
                  </Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {sortedUnits.map((u, i) => (
                  <tr key={`${u.stat_key}-${i}`}>
                    <Td>{u.category ?? 'Misc'}</Td>
                    <Td>{prettyLabel(u.stat_key)}</Td>
                    <Td>{u.points_per_unit ?? ''}</Td>
                    <Td>{u.description ?? ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bands */}
      <div style={{ marginTop: 36 }}>
        <h2>Tiered Bands</h2>
        <p style={{ marginTop: 6, marginBottom: 12 }}>
          Banded rules add bonuses/penalties across ranges (e.g., strike-rate brackets).
        </p>

        {bandsByKey.size === 0 ? (
          <div style={{ opacity: 0.7 }}>No banded rules for this format.</div>
        ) : (
          Array.from(bandsByKey.entries())
            .sort((a, b) => prettyLabel(a[0]).localeCompare(prettyLabel(b[0])))
            .map(([statKey, rawRows], idx) => {
              const lk = statKey.toLowerCase();
              const blurb = BAND_BLURB[lk] ?? '';
              const headerLabel = MILESTONE_KEYS.has(lk) ? 'Milestone' : 'Range';

              const { rows, sortState } = sortBandsForKey(statKey, rawRows);

              return (
                <div key={statKey} style={{ marginTop: idx === 0 ? 12 : 28 }}>
                  <h3 style={{ marginBottom: 4 }}>{prettyLabel(statKey)}</h3>
                  {blurb ? <p style={{ marginTop: 0, marginBottom: 10 }}>{blurb}</p> : null}

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <Th
                            sortable
                            onClick={() => toggleBandsSort(statKey, 'range')}
                            activeKey={sortState.key === 'range'}
                            dir={sortState.dir}
                          >
                            {headerLabel}
                          </Th>
                          <Th
                            sortable
                            onClick={() => toggleBandsSort(statKey, 'points')}
                            activeKey={sortState.key === 'points'}
                            dir={sortState.dir}
                          >
                            Points
                          </Th>
                          <Th>Notes</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={`${statKey}-${i}`}>
                            <Td>{formatBandCell(lk, r.min_incl, r.max_excl)}</Td>
                            <Td>{r.points ?? ''}</Td>
                            <Td>{r.description ?? ''}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

/* ---------- small helpers / presentational ---------- */

// For bands, render either a range, a milestone (X+), or "Greater than X" for open-ended SR/ER.
function formatBandCell(statKey: string, minIncl: number | null, maxExcl: number | null) {
  const k = statKey.toLowerCase();

  // Milestones (e.g., Runs Scored / Wickets Taken) show "X+"
  if (MILESTONE_KEYS.has(k)) {
    const base = minIncl ?? 0;
    return `${base}+`;
  }

  // For SR/ER, the open-ended top band (no max_excl) should read "Greater than X"
  if (RATE_KEYS.has(k) && maxExcl == null && minIncl != null) {
    return `Greater than ${minIncl}`;
  }

  // Default: show a range like "A to < B"
  const left = minIncl == null ? '—' : `${minIncl}`;
  const right = maxExcl == null ? '∞' : `${maxExcl}`;
  return `${left} to < ${right}`;
}

const thTdBase: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
  fontSize: 14,
};

const Th: React.FC<
  React.PropsWithChildren<{
    sortable?: boolean;
    onClick?: () => void;
    activeKey?: boolean;
    dir?: SortDir;
  }>
> = ({ children, sortable, onClick, activeKey, dir }) => {
  const arrow = sortable && activeKey ? (dir === 'asc' ? ' ▲' : ' ▼') : sortable ? ' ↕' : '';
  return (
    <th
      style={{
        ...thTdBase,
        fontWeight: 700,
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onClick={sortable ? onClick : undefined}
      title={sortable ? 'Click to sort' : undefined}
    >
      {children}
      {arrow}
    </th>
  );
};

const Td: React.FC<React.PropsWithChildren> = ({ children }) => <td style={thTdBase}>{children}</td>;
