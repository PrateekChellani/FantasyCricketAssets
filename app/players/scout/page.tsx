'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';

type POS = {
  player_id: number;
  player_full_name: string;
  matches_played: number;
  total_runs_scored: number;
  total_wickets_taken: number;
  total_fours_hit: number;
  total_sixes_hit: number;
  avg_strike_rate: number | null;
  avg_economy_rate: number | null;
  cnt_25_plus: number;
  cnt_30_plus: number;
  cnt_50_plus: number;
  cnt_100_plus: number;
  total_runs_conceded: number;
  avg_runs_conceded: number | null;
  avg_runs_scored: number | null;
  avg_wickets_taken: number | null;
  avg_fours: number | null;
  avg_sixes: number | null;
};

type POPT = {
  player_id: number;
  player_full_name: string;
  matches_played: number;
  total_points: number;
  total_batting_points: number;
  total_bowling_points: number;
  total_fielding_points: number;
  total_misc_points: number;
  avg_points_per_game: number | null;
  avg_batting_points_per_game: number | null;
  avg_bowling_points_per_game: number | null;
  avg_fielding_points_per_game: number | null;
};

type Row = POS & {
  total_points: number;
  total_batting_points: number;
  total_bowling_points: number;
  total_fielding_points: number;
  total_misc_points: number;
  avg_points_per_game: number | null;
  avg_batting_points_per_game: number | null;
  avg_bowling_points_per_game: number | null;
  avg_fielding_points_per_game: number | null;
};

const POS_TABLE = 'v_player_overall_stats';
const POPT_TABLE = 'v_player_overall_point_totals';

const container: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' };
const panel: React.CSSProperties = {
  border: '1px solid #e5e5e5',
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
  background: '#fff',
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 };
const actions: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 8 };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer', background: '#f7f7f7' };
const primaryBtn: React.CSSProperties = { ...btn, background: '#111', color: '#fff', borderColor: '#111' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 10 };
const thtd: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '10px 8px', textAlign: 'left', verticalAlign: 'top', fontSize: 14 };
const theadStyle: React.CSSProperties = { background: '#fafafa', position: 'sticky', top: 0, zIndex: 1 };

function numOrUndef(v: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function Range({
  label, minVal, maxVal, setMin, setMax, placeholderMin = 'min', placeholderMax = 'max',
}: {
  label: string;
  minVal?: string;
  maxVal?: string;
  setMin: (v: string) => void;
  setMax: (v: string) => void;
  placeholderMin?: string;
  placeholderMax?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input style={inputStyle} value={minVal ?? ''} onChange={(e) => setMin(e.target.value)} placeholder={placeholderMin} />
        <input style={inputStyle} value={maxVal ?? ''} onChange={(e) => setMax(e.target.value)} placeholder={placeholderMax} />
      </div>
    </div>
  );
}

export default function PlayerScoutPage() {
  // POS filters
  const [minMatches, setMinMatches] = useState<string>('');
  const [runsMin, setRunsMin] = useState<string>(''); const [runsMax, setRunsMax] = useState<string>('');
  const [wktsMin, setWktsMin] = useState<string>(''); const [wktsMax, setWktsMax] = useState<string>('');
  const [foursMin, setFoursMin] = useState<string>(''); const [foursMax, setFoursMax] = useState<string>('');
  const [sixesMin, setSixesMin] = useState<string>(''); const [sixesMax, setSixesMax] = useState<string>('');
  const [srMin, setSrMin] = useState<string>(''); const [srMax, setSrMax] = useState<string>('');
  const [erMin, setErMin] = useState<string>(''); const [erMax, setErMax] = useState<string>('');
  const [c25Min, setC25Min] = useState<string>(''); const [c25Max, setC25Max] = useState<string>('');
  const [c30Min, setC30Min] = useState<string>(''); const [c30Max, setC30Max] = useState<string>('');
  const [c50Min, setC50Min] = useState<string>(''); const [c50Max, setC50Max] = useState<string>('');
  const [c100Min, setC100Min] = useState<string>(''); const [c100Max, setC100Max] = useState<string>('');
  const [trcMin, setTrcMin] = useState<string>(''); const [trcMax, setTrcMax] = useState<string>('');
  const [arcMin, setArcMin] = useState<string>(''); const [arcMax, setArcMax] = useState<string>('');
  const [arsMin, setArsMin] = useState<string>(''); const [arsMax, setArsMax] = useState<string>('');
  const [awkMin, setAwkMin] = useState<string>(''); const [awkMax, setAwkMax] = useState<string>('');
  const [af4Min, setAf4Min] = useState<string>(''); const [af4Max, setAf4Max] = useState<string>('');
  const [af6Min, setAf6Min] = useState<string>(''); const [af6Max, setAf6Max] = useState<string>('');

  // POPT filters
  const [avgPtsMin, setAvgPtsMin] = useState<string>(''); const [avgPtsMax, setAvgPtsMax] = useState<string>('');
  const [avgBatMin, setAvgBatMin] = useState<string>(''); const [avgBatMax, setAvgBatMax] = useState<string>('');
  const [avgBowlMin, setAvgBowlMin] = useState<string>(''); const [avgBowlMax, setAvgBowlMax] = useState<string>('');
  const [avgFieldMin, setAvgFieldMin] = useState<string>(''); const [avgFieldMax, setAvgFieldMax] = useState<string>('');

  // NEW: toggle to switch columns
  const [showAvg, setShowAvg] = useState<boolean>(true);

  // NEW: filters panel collapsible (default open)
  const [filtersOpen, setFiltersOpen] = useState<boolean>(true);

  // NEW: sorting
  type SortKey =
    | 'player_full_name'
    | 'matches_played'
    | 'avg_strike_rate'
    | 'avg_economy_rate'
    | 'avg_runs_scored'
    | 'avg_fours'
    | 'avg_sixes'
    | 'avg_runs_conceded'
    | 'avg_wickets_taken'
    | 'avg_points_per_game'
    | 'avg_batting_points_per_game'
    | 'avg_bowling_points_per_game'
    | 'avg_fielding_points_per_game'
    | 'total_runs_scored'
    | 'total_fours_hit'
    | 'total_sixes_hit'
    | 'total_runs_conceded'
    | 'total_wickets_taken'
    | 'total_points'
    | 'total_batting_points'
    | 'total_bowling_points'
    | 'total_fielding_points';

  type SortDir = 'asc' | 'desc';

  const [sortKey, setSortKey] = useState<SortKey>('avg_points_per_game');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runSearch() {
    setBusy(true);
    setErr(null);
    try {
      let posQ = supabase.from(POS_TABLE).select('*');

      const mm = numOrUndef(minMatches); if (mm !== undefined) posQ = posQ.gte('matches_played', mm);
      const rmin = numOrUndef(runsMin); if (rmin !== undefined) posQ = posQ.gte('total_runs_scored', rmin);
      const rmax = numOrUndef(runsMax); if (rmax !== undefined) posQ = posQ.lte('total_runs_scored', rmax);
      const wmin = numOrUndef(wktsMin); if (wmin !== undefined) posQ = posQ.gte('total_wickets_taken', wmin);
      const wmax = numOrUndef(wktsMax); if (wmax !== undefined) posQ = posQ.lte('total_wickets_taken', wmax);
      const fmin = numOrUndef(foursMin); if (fmin !== undefined) posQ = posQ.gte('total_fours_hit', fmin);
      const fmax = numOrUndef(foursMax); if (fmax !== undefined) posQ = posQ.lte('total_fours_hit', fmax);
      const smin = numOrUndef(sixesMin); if (smin !== undefined) posQ = posQ.gte('total_sixes_hit', smin);
      const smax = numOrUndef(sixesMax); if (smax !== undefined) posQ = posQ.lte('total_sixes_hit', smax);

      const srmin = numOrUndef(srMin); if (srmin !== undefined) posQ = posQ.gte('avg_strike_rate', srmin);
      const srmax = numOrUndef(srMax); if (srmax !== undefined) posQ = posQ.lte('avg_strike_rate', srmax);
      const ermin = numOrUndef(erMin); if (ermin !== undefined) posQ = posQ.gte('avg_economy_rate', ermin);
      const ermax = numOrUndef(erMax); if (ermax !== undefined) posQ = posQ.lte('avg_economy_rate', ermax);

      const c25min = numOrUndef(c25Min); if (c25min !== undefined) posQ = posQ.gte('cnt_25_plus', c25min);
      const c25max = numOrUndef(c25Max); if (c25max !== undefined) posQ = posQ.lte('cnt_25_plus', c25max);
      const c30min = numOrUndef(c30Min); if (c30min !== undefined) posQ = posQ.gte('cnt_30_plus', c30min);
      const c30max = numOrUndef(c30Max); if (c30max !== undefined) posQ = posQ.lte('cnt_30_plus', c30max);
      const c50min = numOrUndef(c50Min); if (c50min !== undefined) posQ = posQ.gte('cnt_50_plus', c50min);
      const c50max = numOrUndef(c50Max); if (c50max !== undefined) posQ = posQ.lte('cnt_50_plus', c50max);
      const c100min = numOrUndef(c100Min); if (c100min !== undefined) posQ = posQ.gte('cnt_100_plus', c100min);
      const c100max = numOrUndef(c100Max); if (c100max !== undefined) posQ = posQ.lte('cnt_100_plus', c100max);

      const trcmin = numOrUndef(trcMin); if (trcmin !== undefined) posQ = posQ.gte('total_runs_conceded', trcmin);
      const trcmax = numOrUndef(trcMax); if (trcmax !== undefined) posQ = posQ.lte('total_runs_conceded', trcmax);
      const arcmin = numOrUndef(arcMin); if (arcmin !== undefined) posQ = posQ.gte('avg_runs_conceded', arcmin);
      const arcmax = numOrUndef(arcMax); if (arcmax !== undefined) posQ = posQ.lte('avg_runs_conceded', arcmax);
      const arsmin = numOrUndef(arsMin); if (arsmin !== undefined) posQ = posQ.gte('avg_runs_scored', arsmin);
      const arsmax = numOrUndef(arsMax); if (arsmax !== undefined) posQ = posQ.lte('avg_runs_scored', arsmax);
      const awkmin = numOrUndef(awkMin); if (awkmin !== undefined) posQ = posQ.gte('avg_wickets_taken', awkmin);
      const awkmax = numOrUndef(awkMax); if (awkmax !== undefined) posQ = posQ.lte('avg_wickets_taken', awkmax);
      const af4min = numOrUndef(af4Min); if (af4min !== undefined) posQ = posQ.gte('avg_fours', af4min);
      const af4max = numOrUndef(af4Max); if (af4max !== undefined) posQ = posQ.lte('avg_fours', af4max);
      const af6min = numOrUndef(af6Min); if (af6min !== undefined) posQ = posQ.gte('avg_sixes', af6min);
      const af6max = numOrUndef(af6Max); if (af6max !== undefined) posQ = posQ.lte('avg_sixes', af6max);

      const posRes = await posQ;
      if (posRes.error) throw posRes.error;
      const pos = (posRes.data ?? []) as POS[];

      if (pos.length === 0) {
        setRows([]);
        setBusy(false);
        return;
      }

      const ids = pos.map((p) => p.player_id);
      let poptQ = supabase.from(POPT_TABLE).select('*').in('player_id', ids);

      const apmin = numOrUndef(avgPtsMin); if (apmin !== undefined) poptQ = poptQ.gte('avg_points_per_game', apmin);
      const apmax = numOrUndef(avgPtsMax); if (apmax !== undefined) poptQ = poptQ.lte('avg_points_per_game', apmax);
      const abmin = numOrUndef(avgBatMin); if (abmin !== undefined) poptQ = poptQ.gte('avg_batting_points_per_game', abmin);
      const abmax = numOrUndef(avgBatMax); if (abmax !== undefined) poptQ = poptQ.lte('avg_batting_points_per_game', abmax);
      const abwmin = numOrUndef(avgBowlMin); if (abwmin !== undefined) poptQ = poptQ.gte('avg_bowling_points_per_game', abwmin);
      const abwmax = numOrUndef(avgBowlMax); if (abwmax !== undefined) poptQ = poptQ.lte('avg_bowling_points_per_game', abwmax);
      const afmin = numOrUndef(avgFieldMin); if (afmin !== undefined) poptQ = poptQ.gte('avg_fielding_points_per_game', afmin);
      const afmax2 = numOrUndef(avgFieldMax); if (afmax2 !== undefined) poptQ = poptQ.lte('avg_fielding_points_per_game', afmax2);

      const poptRes = await poptQ;
      if (poptRes.error) throw poptRes.error;
      const popt = (poptRes.data ?? []) as POPT[];

      const poptMap = new Map<number, POPT>(popt.map((r) => [r.player_id, r]));

      const merged: Row[] = pos.map((p) => {
        const x = poptMap.get(p.player_id);
        return {
          ...p,
          total_points: x?.total_points ?? 0,
          total_batting_points: x?.total_batting_points ?? 0,
          total_bowling_points: x?.total_bowling_points ?? 0,
          total_fielding_points: x?.total_fielding_points ?? 0,
          total_misc_points: x?.total_misc_points ?? 0,
          avg_points_per_game: x?.avg_points_per_game ?? 0,
          avg_batting_points_per_game: x?.avg_batting_points_per_game ?? 0,
          avg_bowling_points_per_game: x?.avg_bowling_points_per_game ?? 0,
          avg_fielding_points_per_game: x?.avg_fielding_points_per_game ?? 0,
        };
      });

      setRows(merged);
    } catch (e: any) {
      setErr(e?.message ?? 'Search failed');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'player_full_name' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  const sortedRows = useMemo(() => {
    const arr = [...rows];

    const getVal = (r: Row) => {
      switch (sortKey) {
        case 'player_full_name': return r.player_full_name ?? '';
        case 'matches_played': return r.matches_played ?? 0;

        case 'avg_strike_rate': return r.avg_strike_rate ?? Number.NEGATIVE_INFINITY;
        case 'avg_economy_rate': return r.avg_economy_rate ?? Number.NEGATIVE_INFINITY;
        case 'avg_runs_scored': return r.avg_runs_scored ?? Number.NEGATIVE_INFINITY;
        case 'avg_fours': return r.avg_fours ?? Number.NEGATIVE_INFINITY;
        case 'avg_sixes': return r.avg_sixes ?? Number.NEGATIVE_INFINITY;
        case 'avg_runs_conceded': return r.avg_runs_conceded ?? Number.NEGATIVE_INFINITY;
        case 'avg_wickets_taken': return r.avg_wickets_taken ?? Number.NEGATIVE_INFINITY;

        case 'avg_points_per_game': return r.avg_points_per_game ?? Number.NEGATIVE_INFINITY;
        case 'avg_batting_points_per_game': return r.avg_batting_points_per_game ?? Number.NEGATIVE_INFINITY;
        case 'avg_bowling_points_per_game': return r.avg_bowling_points_per_game ?? Number.NEGATIVE_INFINITY;
        case 'avg_fielding_points_per_game': return r.avg_fielding_points_per_game ?? Number.NEGATIVE_INFINITY;

        case 'total_runs_scored': return r.total_runs_scored ?? 0;
        case 'total_fours_hit': return r.total_fours_hit ?? 0;
        case 'total_sixes_hit': return r.total_sixes_hit ?? 0;
        case 'total_runs_conceded': return r.total_runs_conceded ?? 0;
        case 'total_wickets_taken': return r.total_wickets_taken ?? 0;

        case 'total_points': return r.total_points ?? 0;
        case 'total_batting_points': return r.total_batting_points ?? 0;
        case 'total_bowling_points': return r.total_bowling_points ?? 0;
        case 'total_fielding_points': return r.total_fielding_points ?? 0;
      }
    };

    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = getVal(a) as any;
      const bv = getVal(b) as any;

      if (typeof av === 'string' && typeof bv === 'string') return dir * av.localeCompare(bv);
      return dir * ((av as number) - (bv as number));
    });

    return arr;
  }, [rows, sortKey, sortDir]);

  const header = useMemo(() => {
    const thClickable = (label: string, key: SortKey) => (
      <th style={{ ...thtd, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(key)}>
        {label}{sortIndicator(key)}
      </th>
    );

    return (
      <thead style={theadStyle}>
        {showAvg ? (
          <tr>
            {thClickable('Player', 'player_full_name')}
            {thClickable('Mat', 'matches_played')}
            {thClickable('SR', 'avg_strike_rate')}
            {thClickable('ER', 'avg_economy_rate')}
            {thClickable('Avg Run Scored', 'avg_runs_scored')}
            {thClickable('Avg 4s', 'avg_fours')}
            {thClickable('Avg 6s', 'avg_sixes')}
            {thClickable('Avg Run Conceded', 'avg_runs_conceded')}
            {thClickable('Avg Wickets', 'avg_wickets_taken')}
            {thClickable('Avg Pts.', 'avg_points_per_game')}
            {thClickable('Avg Bat Pts.', 'avg_batting_points_per_game')}
            {thClickable('Avg Bowl Pts.', 'avg_bowling_points_per_game')}
            {thClickable('Avg Field Pts.', 'avg_fielding_points_per_game')}
          </tr>
        ) : (
          <tr>
            {thClickable('Player', 'player_full_name')}
            {thClickable('Mat', 'matches_played')}
            {thClickable('SR', 'avg_strike_rate')}
            {thClickable('ER', 'avg_economy_rate')}
            {thClickable('Total Run Scored', 'total_runs_scored')}
            {thClickable('Total 4s', 'total_fours_hit')}
            {thClickable('Total 6s', 'total_sixes_hit')}
            {thClickable('Total Run Conceded', 'total_runs_conceded')}
            {thClickable('Total Wickets', 'total_wickets_taken')}
            {thClickable('Total Pts.', 'total_points')}
            {thClickable('Total Bat Pts.', 'total_batting_points')}
            {thClickable('Total Bowl Pts.', 'total_bowling_points')}
            {thClickable('Total Field Pts.', 'total_fielding_points')}
          </tr>
        )}
      </thead>
    );
  }, [showAvg, sortKey, sortDir]);

  return (
    <div style={container}>
      <h1>Player Scout</h1>

      {/* NEW: collapsible filters panel (default open) */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <button
            type="button"
            style={btn}
            onClick={() => setFiltersOpen((s) => !s)}
            aria-label={filtersOpen ? 'Collapse filters' : 'Expand filters'}
          >
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
        </div>

        {filtersOpen && (
          <>
            <div style={{ height: 12 }} />

            <div style={grid}>
              <div>
                <label style={labelStyle}>Min Matches</label>
                <input style={inputStyle} value={minMatches} onChange={(e) => setMinMatches(e.target.value)} placeholder="e.g. 3" />
              </div>

              <Range label="Total Runs" minVal={runsMin} maxVal={runsMax} setMin={setRunsMin} setMax={setRunsMax} />
              <Range label="Total Wickets" minVal={wktsMin} maxVal={wktsMax} setMin={setWktsMin} setMax={setWktsMax} />

              <Range label="Total 4s" minVal={foursMin} maxVal={foursMax} setMin={setFoursMin} setMax={setFoursMax} />
              <Range label="Total 6s" minVal={sixesMin} maxVal={sixesMax} setMin={setSixesMin} setMax={setSixesMax} />

              <Range label="Avg Strike Rate" minVal={srMin} maxVal={srMax} setMin={setSrMin} setMax={setSrMax} />
              <Range label="Avg Economy Rate" minVal={erMin} maxVal={erMax} setMin={setErMin} setMax={setErMax} />

              <Range label="25+ Scores" minVal={c25Min} maxVal={c25Max} setMin={setC25Min} setMax={setC25Max} />
              <Range label="30+ Scores" minVal={c30Min} maxVal={c30Max} setMin={setC30Min} setMax={setC30Max} />
              <Range label="50+ Scores" minVal={c50Min} maxVal={c50Max} setMin={setC50Min} setMax={setC50Max} />
              <Range label="100+ Scores" minVal={c100Min} maxVal={c100Max} setMin={setC100Min} setMax={setC100Max} />

              <Range label="Total Runs Conceded" minVal={trcMin} maxVal={trcMax} setMin={setTrcMin} setMax={setTrcMax} />
              <Range label="Avg Runs Conceded" minVal={arcMin} maxVal={arcMax} setMin={setArcMin} setMax={setArcMax} />
              <Range label="Avg Runs Scored" minVal={arsMin} maxVal={arsMax} setMin={setArsMin} setMax={setArsMax} />
              <Range label="Avg Wickets Taken" minVal={awkMin} maxVal={awkMax} setMin={setAwkMin} setMax={setAwkMax} />
              <Range label="Avg 4s" minVal={af4Min} maxVal={af4Max} setMin={setAf4Min} setMax={setAf4Max} />
              <Range label="Avg 6s" minVal={af6Min} maxVal={af6Max} setMin={setAf6Min} setMax={setAf6Max} />

              <Range label="Avg Points / Match" minVal={avgPtsMin} maxVal={avgPtsMax} setMin={setAvgPtsMin} setMax={setAvgPtsMax} />
              <Range label="Avg Batting Pts / Match" minVal={avgBatMin} maxVal={avgBatMax} setMin={setAvgBatMin} setMax={setAvgBatMax} />
              <Range label="Avg Bowling Pts / Match" minVal={avgBowlMin} maxVal={avgBowlMax} setMin={setAvgBowlMin} setMax={setAvgBowlMax} />
              <Range label="Avg Fielding Pts / Match" minVal={avgFieldMin} maxVal={avgFieldMax} setMin={setAvgFieldMin} setMax={setAvgFieldMax} />
            </div>

            {/* Toggle */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                id="toggle-avg"
                type="checkbox"
                checked={showAvg}
                onChange={(e) => setShowAvg(e.target.checked)}
              />
              <label htmlFor="toggle-avg" style={{ fontSize: 14, userSelect: 'none' }}>
                Show Average Match Stats
              </label>
            </div>

            <div style={actions}>
              <button style={primaryBtn} onClick={runSearch} disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
              <button
                style={btn}
                onClick={() => {
                  setMinMatches('');
                  setRunsMin(''); setRunsMax('');
                  setWktsMin(''); setWktsMax('');
                  setFoursMin(''); setFoursMax('');
                  setSixesMin(''); setSixesMax('');
                  setSrMin(''); setSrMax('');
                  setErMin(''); setErMax('');
                  setC25Min(''); setC25Max('');
                  setC30Min(''); setC30Max('');
                  setC50Min(''); setC50Max('');
                  setC100Min(''); setC100Max('');
                  setTrcMin(''); setTrcMax('');
                  setArcMin(''); setArcMax('');
                  setArsMin(''); setArsMax('');
                  setAwkMin(''); setAwkMax('');
                  setAf4Min(''); setAf4Max('');
                  setAf6Min(''); setAf6Max('');
                  setAvgPtsMin(''); setAvgPtsMax('');
                  setAvgBatMin(''); setAvgBatMax('');
                  setAvgBowlMin(''); setAvgBowlMax('');
                  setAvgFieldMin(''); setAvgFieldMax('');
                  setRows([]);
                }}
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      {err && <div style={{ color: 'crimson', marginBottom: 10 }}>{err}</div>}

      <div style={panel}>
        {sortedRows.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No players matched your filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              {header}
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.player_id}>
                    <td style={thtd}>
                      <Link href={`/players/${r.player_id}`} style={{ textDecoration: 'underline' }}>
                        {r.player_full_name}
                      </Link>
                    </td>
                    <td style={thtd}>{r.matches_played}</td>
                    <td style={thtd}>{r.avg_strike_rate ?? '-'}</td>
                    <td style={thtd}>{r.avg_economy_rate ?? '-'}</td>

                    {showAvg ? (
                      <>
                        <td style={thtd}>{r.avg_runs_scored ?? '-'}</td>
                        <td style={thtd}>{r.avg_fours ?? '-'}</td>
                        <td style={thtd}>{r.avg_sixes ?? '-'}</td>
                        <td style={thtd}>{r.avg_runs_conceded ?? '-'}</td>
                        <td style={thtd}>{r.avg_wickets_taken ?? '-'}</td>
                        <td style={thtd}>{r.avg_points_per_game ?? '-'}</td>
                        <td style={thtd}>{r.avg_batting_points_per_game ?? '-'}</td>
                        <td style={thtd}>{r.avg_bowling_points_per_game ?? '-'}</td>
                        <td style={thtd}>{r.avg_fielding_points_per_game ?? '-'}</td>
                      </>
                    ) : (
                      <>
                        <td style={thtd}>{r.total_runs_scored}</td>
                        <td style={thtd}>{r.total_fours_hit}</td>
                        <td style={thtd}>{r.total_sixes_hit}</td>
                        <td style={thtd}>{r.total_runs_conceded}</td>
                        <td style={thtd}>{r.total_wickets_taken}</td>
                        <td style={thtd}>{r.total_points}</td>
                        <td style={thtd}>{r.total_batting_points}</td>
                        <td style={thtd}>{r.total_bowling_points}</td>
                        <td style={thtd}>{r.total_fielding_points}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
