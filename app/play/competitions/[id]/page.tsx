'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type CompetitionUiRow = {
  competition_id: number;
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

  competition_instance_id: number | null;
};

type GameweekRow = {
  gameweek_id: number;
  name: string;
  start_ts: string;
  end_ts: string;
};

type LeaderboardRow = {
  competition_instance_id: number;
  rank: number;
  submission_id: number;
  user_id: string;
  final_points: string | number | null;
  submitted_at: string | null;
  tie_break_rand: string | number | null;
  computed_at: string | null;
};

type PrizePreviewRow = {
  competition_instance_id: number;
  submission_id: number;
  user_id: string;
  rank: number;
  final_points: string | number | null;
  submitted_at: string | null;
  eligible_n: number;
  is_me: boolean;
  expected_prize_rule_id: number | null;
  expected_prize_label: string | null;
  expected_prize_priority: number | null;
  expected_rule_kind: string | null;
  expected_rank_from: number | null;
  expected_rank_to: number | null;
  expected_percentile: string | number | null;
  expected_prize_items: any;
  expected_prize_display: string | null;
};

type MatchOverviewRow = {
  match_id: number;
  format: string;
  match_date: string; // date
  venue: string | null;
  match_name: string | null;
  dated_name: string | null;
  competition_id: number | null;
  competition: string | null;
};

type MatchLogoRow = {
  id: number;
  team_home_logo: string | null;
  team_away_logo: string | null;
};

/** static prize pool row type (from your existing view headers) */
type PrizePoolStaticRow = {
  competition_instance_id: number;

  prize_rule_id: number;
  rule_kind: string;
  rank_from: number | null;
  rank_to: number | null;
  percentile: string | number | null;
  priority: number | null;
  label: string | null;
  active: boolean | null;
  rule_created_at: string | null;

  prize_item_id: number;
  prize_type: string;
  qty: number | null;
  cp_amount: string | number | null;
  pack_template_id: number | null;
  card_player_id: number | null;
  item_created_at: string | null;
};

type UserDisplayRow = {
  user_id: string;
  display_name: string;
  image?: string | null;
};

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

function shortId(id: string) {
  if (!id) return '—';
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function Modal(props: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  const { title, open, onClose, children, maxWidth } = props;
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(100%, ' + String(maxWidth ?? 900) + 'px)',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid #eee',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: '1px solid #e5e5e5',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: 18,
              lineHeight: '34px',
              textAlign: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export default function CompetitionInstancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const ciId = Number((params as any)?.ID ?? (params as any)?.id ?? (params as any)?.[0] ?? NaN);

  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [comp, setComp] = useState<CompetitionUiRow | null>(null);
  const [gw, setGw] = useState<GameweekRow | null>(null);

  const [prizeOpen, setPrizeOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);

  const [lbLoading, setLbLoading] = useState(false);
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);

  const [prizeLoading, setPrizeLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PrizePreviewRow[]>([]);

  const [staticPrizeRows, setStaticPrizeRows] = useState<PrizePoolStaticRow[]>([]);

  /** NEW: lookup maps for pack template names + player names */
  const [packNameById, setPackNameById] = useState<Map<number, string>>(new Map());
  const [playerNameById, setPlayerNameById] = useState<Map<number, string>>(new Map());

  const [eligibleOpen, setEligibleOpen] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [eligibleMatches, setEligibleMatches] = useState<MatchOverviewRow[]>([]);
  const [matchLogoById, setMatchLogoById] = useState<Map<number, MatchLogoRow>>(new Map());

  // display name lookup for leaderboard users (from public.v_user_profiles)
  const [userDisplayById, setUserDisplayById] = useState<Map<string, UserDisplayRow>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // Open correct modal based on ?modal=prize|leaderboard
  useEffect(() => {
    const modal = (searchParams.get('modal') ?? '').toLowerCase();

    if (modal === 'prize') setPrizeOpen(true);
    if (modal === 'leaderboard') setLbOpen(true);

    if (modal === 'prize' || modal === 'leaderboard') {
      const url = new URL(window.location.href);
      url.searchParams.delete('modal');
      router.replace(url.pathname + url.search, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load comp + gw
  useEffect(() => {
    if (!Number.isFinite(ciId)) {
      setBanner('Invalid competition instance id.');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setBanner(null);

      const { data: cData, error: cErr } = await supabase
        .from('v_competitions_ui')
        .select(
          `
          competition_id,
          gameweek_id,
          template_id,
          competition_name,
          competition_description,
          entry_fee,
          prize,
          template_key,
          template_name,
          template_description,
          team_size_max,
          enforce_team_rules,
          only_format,
          allow_multi_entry,
          competition_instance_id
        `
        )
        .eq('competition_instance_id', ciId)
        .maybeSingle();

      if (cErr) {
        setBanner(`Failed to load competition instance: ${cErr.message}`);
        setComp(null);
        setGw(null);
        setLoading(false);
        return;
      }

      if (!cData) {
        setComp(null);
        setGw(null);
        setLoading(false);
        return;
      }

      setComp(cData as any);

      const { data: gwData, error: gwErr } = await supabase
        .from('gameweeks')
        .select('gameweek_id,name,start_ts,end_ts')
        .eq('gameweek_id', (cData as any).gameweek_id)
        .maybeSingle();

      if (gwErr) {
        setBanner(`Failed to load gameweek: ${gwErr.message}`);
        setGw(null);
      } else {
        setGw((gwData as any) ?? null);
      }

      setLoading(false);
    })();
  }, [ciId]);

  async function fetchUserDisplays(userIds: string[]) {
    const uniq = Array.from(new Set(userIds.filter(Boolean)));
    if (uniq.length === 0) return new Map<string, UserDisplayRow>();

    const { data, error } = await supabase
      .from('v_user_profiles')
      .select('user_id,display_name,avatar_path')
      .in('user_id', uniq as any);

    if (error) return new Map<string, UserDisplayRow>();

    const m = new Map<string, UserDisplayRow>();
    for (const r of (((data as any) ?? []) as any[])) {
      const uid = String(r.user_id ?? '');
      const dn = String(r.display_name ?? '');
      if (uid && dn) m.set(uid, { user_id: uid, display_name: dn, image: (r.avatar_path ?? null) as any });
    }
    return m;
  }

  // Load leaderboard when modal opens
  useEffect(() => {
    if (!lbOpen || !Number.isFinite(ciId)) return;

    (async () => {
      setLbLoading(true);
      setBanner(null);

      const { data, error } = await supabase
        .from('v_competition_instance_leaderboard')
        .select('competition_instance_id,rank,submission_id,user_id,final_points,submitted_at,tie_break_rand,computed_at')
        .eq('competition_instance_id', ciId)
        .order('rank', { ascending: true });

      if (error) {
        setBanner(`Failed to load leaderboard: ${error.message}`);
        setLbRows([]);
        setUserDisplayById(new Map());
      } else {
        const rows = (((data as any) ?? []) as LeaderboardRow[]).filter((r) => Number.isFinite(Number(r.rank)));
        setLbRows(rows);

        const ids = rows.map((r) => r.user_id).filter(Boolean);
        const m = await fetchUserDisplays(ids);
        setUserDisplayById(m);
      }

      setLbLoading(false);
    })();
  }, [lbOpen, ciId]);

  // Load prize preview rows when modal opens + static prize pool + names
  useEffect(() => {
    if (!prizeOpen || !Number.isFinite(ciId)) return;

    (async () => {
      setPrizeLoading(true);
      setBanner(null);

      const { data, error } = await supabase
        .from('v_competition_instance_prize_preview')
        .select(
          `
          competition_instance_id,
          submission_id,
          user_id,
          rank,
          final_points,
          submitted_at,
          eligible_n,
          is_me,
          expected_prize_rule_id,
          expected_prize_label,
          expected_prize_priority,
          expected_rule_kind,
          expected_rank_from,
          expected_rank_to,
          expected_percentile,
          expected_prize_items,
          expected_prize_display
        `
        )
        .eq('competition_instance_id', ciId)
        .order('rank', { ascending: true });

      if (error) {
        setBanner(`Failed to load prize preview: ${error.message}`);
        setPreviewRows([]);
      } else {
        setPreviewRows(((data as any) ?? []) as PrizePreviewRow[]);
      }

      const { data: sData, error: sErr } = await supabase
        .from('v_competition_instance_prize_pool')
        .select(
          `
          competition_instance_id,
          prize_rule_id,
          rule_kind,
          rank_from,
          rank_to,
          percentile,
          priority,
          label,
          active,
          rule_created_at,
          prize_item_id,
          prize_type,
          qty,
          cp_amount,
          pack_template_id,
          card_player_id,
          item_created_at
        `
        )
        .eq('competition_instance_id', ciId)
        .order('priority', { ascending: true })
        .order('prize_item_id', { ascending: true });

      if (sErr) {
        setStaticPrizeRows([]);
        setPackNameById(new Map());
        setPlayerNameById(new Map());
      } else {
        const rows = ((sData as any) ?? []) as PrizePoolStaticRow[];
        setStaticPrizeRows(rows);

        const packIds = Array.from(new Set(rows.map((r) => r.pack_template_id).filter((x): x is number => Number.isFinite(Number(x))))).map(Number);
        const playerIds = Array.from(new Set(rows.map((r) => r.card_player_id).filter((x): x is number => Number.isFinite(Number(x))))).map(Number);

        if (packIds.length === 0) {
          setPackNameById(new Map());
        } else {
          const { data: pData } = await supabase.from('pack_templates').select('pack_template_id,name').in('pack_template_id', packIds);
          const m = new Map<number, string>();
          for (const r of (((pData as any) ?? []) as any[])) {
            const id = Number(r.pack_template_id);
            if (Number.isFinite(id) && r.name) m.set(id, String(r.name));
          }
          setPackNameById(m);
        }

        if (playerIds.length === 0) {
          setPlayerNameById(new Map());
        } else {
          const { data: plData } = await supabase.from('players').select('player_id,full_name').in('player_id', playerIds);
          const m2 = new Map<number, string>();
          for (const r of (((plData as any) ?? []) as any[])) {
            const id = Number(r.player_id);
            if (Number.isFinite(id) && r.full_name) m2.set(id, String(r.full_name));
          }
          setPlayerNameById(m2);
        }
      }

      setPrizeLoading(false);
    })();
  }, [prizeOpen, ciId]);

  // Build static prize pool rows (with pack/player names)
  const prizePoolRows = useMemo(() => {
    const byRule = new Map<number, { label: string; rankFrom: number | null; rankTo: number | null; priority: number; items: PrizePoolStaticRow[] }>();

    for (const r of staticPrizeRows) {
      const ruleId = Number(r.prize_rule_id);
      if (!Number.isFinite(ruleId)) continue;

      const existing = byRule.get(ruleId);
      if (!existing) {
        byRule.set(ruleId, {
          label: r.label ?? '—',
          rankFrom: r.rank_from ?? null,
          rankTo: r.rank_to ?? null,
          priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 999999,
          items: [r],
        });
      } else {
        existing.items.push(r);
      }
    }

    const rules = Array.from(byRule.entries())
      .map(([ruleId, v]) => ({
        ruleId,
        label: v.label,
        rankFrom: v.rankFrom,
        rankTo: v.rankTo,
        priority: v.priority,
        items: v.items.slice().sort((a, b) => Number(a.prize_item_id) - Number(b.prize_item_id)),
      }))
      .sort((a, b) => {
        const aStart = a.rankFrom ?? 999999;
        const bStart = b.rankFrom ?? 999999;
        if (aStart !== bStart) return aStart - bStart;
        return (a.priority ?? 999999) - (b.priority ?? 999999);
      });

    const ordinal = (n: number) => {
      if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
      const mod = n % 10;
      if (mod === 1) return `${n}st`;
      if (mod === 2) return `${n}nd`;
      if (mod === 3) return `${n}rd`;
      return `${n}th`;
    };

    const buildDisplayParts = (items: PrizePoolStaticRow[]) => {
      const parts: Array<{ kind: 'CP' | 'TEXT'; cpValue?: number; text?: string }> = [];

      for (const it of items) {
        const t = String(it.prize_type ?? '').toUpperCase();
        const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1;

        if (t === 'CP') {
          const cp = toNum(it.cp_amount) ?? 0;
          const total = cp * qty;
          parts.push({ kind: 'CP', cpValue: total });
        } else if (t === 'PACK') {
          const pt = it.pack_template_id ?? null;
          const packName = pt !== null ? packNameById.get(Number(pt)) ?? null : null;
          parts.push({
            kind: 'TEXT',
            text: `${qty} ${packName ?? (pt ? `Pack Template ${pt}` : 'Pack')}`,
          });
        } else if (t === 'CARD') {
          const pid = it.card_player_id ?? null;
          const playerName = pid !== null ? playerNameById.get(Number(pid)) ?? null : null;
          parts.push({
            kind: 'TEXT',
            text: `${qty} ${playerName ?? (pid ? `Player ${pid}` : 'Player')} Card`,
          });
        } else if (t === 'NONE') {
          parts.push({ kind: 'TEXT', text: 'No prize' });
        } else {
          parts.push({ kind: 'TEXT', text: `${qty} ${t}` });
        }
      }

      const cpTotal = parts.filter((p) => p.kind === 'CP').reduce((acc, p) => acc + (p.cpValue ?? 0), 0);
      const textParts = parts.filter((p) => p.kind === 'TEXT' && p.text).map((p) => p.text as string);

      const out: Array<{ type: 'CP' | 'TEXT'; value: string; cpValue?: number }> = [];
      if (cpTotal !== 0) out.push({ type: 'CP', value: `${cpTotal} CP`, cpValue: cpTotal });
      for (const tp of textParts) out.push({ type: 'TEXT', value: tp });

      return out;
    };

    return rules.map((r) => {
      const isSingleRank = r.rankFrom !== null && r.rankTo !== null && r.rankFrom === r.rankTo;
      const rankLabel =
        isSingleRank && r.rankFrom !== null
          ? ordinal(r.rankFrom)
          : r.rankFrom !== null && r.rankTo !== null
          ? `${r.rankFrom}–${r.rankTo}`
          : r.label ?? '—';

      return {
        rankLabel,
        rankStart: r.rankFrom ?? null,
        displayParts: buildDisplayParts(r.items),
      };
    });
  }, [staticPrizeRows, packNameById, playerNameById]);

  // Eligible matches loader (only when expanded)
  useEffect(() => {
    if (!eligibleOpen) return;
    if (!gw || !comp) return;

    (async () => {
      setMatchesLoading(true);
      setBanner(null);

      try {
        const startDate = gw.start_ts ? new Date(gw.start_ts) : null;
        const endDate = gw.end_ts ? new Date(gw.end_ts) : null;

        const startYmd = startDate ? startDate.toISOString().slice(0, 10) : null;
        const endYmd = endDate ? endDate.toISOString().slice(0, 10) : null;

        let q = supabase
          .from('v_matches_overview')
          .select('match_id,format,match_date,venue,match_name,dated_name,competition_id,competition')
          .order('match_date', { ascending: true })
          .order('match_id', { ascending: true });

        if (startYmd) q = q.gte('match_date', startYmd);
        if (endYmd) q = q.lte('match_date', endYmd);
        if (comp.only_format) q = q.eq('format', comp.only_format);

        const { data, error } = await q;
        if (error) throw new Error(error.message);

        const rows = (((data as any) ?? []) as MatchOverviewRow[]).filter((m) => Number.isFinite(Number(m.match_id)));
        setEligibleMatches(rows);

        const ids = rows.map((r) => Number(r.match_id)).filter((x) => Number.isFinite(x));
        const uniq = Array.from(new Set(ids));

        if (uniq.length === 0) {
          setMatchLogoById(new Map());
        } else {
          const { data: logoData, error: logoErr } = await supabase.from('v_matches').select('id,team_home_logo,team_away_logo').in('id', uniq);

          if (logoErr) {
            setMatchLogoById(new Map());
          } else {
            const m = new Map<number, MatchLogoRow>();
            for (const r of (((logoData as any) ?? []) as any[])) {
              const id = Number(r.id);
              if (Number.isFinite(id)) {
                m.set(id, { id, team_home_logo: r.team_home_logo ?? null, team_away_logo: r.team_away_logo ?? null });
              }
            }
            setMatchLogoById(m);
          }
        }
      } catch (e: any) {
        setBanner(e?.message ?? 'Failed to load eligible matches.');
        setEligibleMatches([]);
        setMatchLogoById(new Map());
      }

      setMatchesLoading(false);
    })();
  }, [eligibleOpen, gw?.gameweek_id, comp?.competition_instance_id]);

  const pageTitle = comp?.competition_name ?? `Competition ${ciId}`;
  const meId = userId;

  const cpIconUrl = 'https://fantasy-cricket-assets.vercel.app/assets/cp.png';
  const iconStyle: React.CSSProperties = { width: 16, height: 16, objectFit: 'contain', display: 'block' };

  // allow clicking submission id only if competition start date is in the past
  const canClickSubmission = useMemo(() => {
    if (!gw?.start_ts) return false;
    return new Date(gw.start_ts).getTime() < Date.now();
  }, [gw?.start_ts]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{pageTitle}</h1>
          <div style={{ marginTop: 6, color: '#555' }}>{comp?.competition_description ?? comp?.template_description ?? '—'}</div>
        </div>

        <Link
          href="/play"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            background: '#fff',
            color: '#111',
            fontWeight: 800,
            textDecoration: 'none',
            height: 40,
          }}
        >
          ← Back to Play
        </Link>
      </div>

      {banner ? (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            background: '#fff7ed',
            color: '#7c2d12',
            fontWeight: 800,
          }}
        >
          {banner}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 18 }}>Loading…</div>
      ) : !comp || !gw ? (
        <div style={{ marginTop: 18 }}>Competition instance not found.</div>
      ) : (
        <>
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#444', fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 900, color: '#111' }}>Gameweek:</span> {gw.name}
                </div>
                <div>
                  <span style={{ fontWeight: 900, color: '#111' }}>Format:</span> {comp?.only_format ?? 'Any'}
                </div>
                <div>
                  <span style={{ fontWeight: 900, color: '#111' }}>Start:</span> {new Date(gw.start_ts).toLocaleString()}
                </div>
                <div>
                  <span style={{ fontWeight: 900, color: '#111' }}>End:</span> {new Date(gw.end_ts).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPrizeOpen(true)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  View Prize Pool
                </button>

                <button
                  onClick={() => setLbOpen(true)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #e5e5e5',
                    background: '#fff',
                    color: '#111',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  View Leaderboard
                </button>
              </div>
            </div>
          </div>

          {/* Eligible Matches */}
          <div
            style={{
              marginTop: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 14,
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setEligibleOpen((v) => !v)}
              style={{
                width: '100%',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: '#fff',
                border: 'none',
                fontWeight: 900,
              }}
            >
              <span>Eligible Matches</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{eligibleOpen ? '−' : '+'}</span>
            </button>

            {eligibleOpen && (
              <div style={{ padding: 14, borderTop: '1px solid #eee' }}>
                {matchesLoading ? (
                  <div style={{ color: '#555' }}>Loading matches…</div>
                ) : eligibleMatches.length === 0 ? (
                  <div style={{ color: '#555' }}>No eligible matches found for this competition window.</div>
                ) : (
                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Date</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Match</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Tournament</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Venue</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Format</th>
                          <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Teams</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleMatches.map((m) => {
                          const logos = matchLogoById.get(Number(m.match_id));
                          const home = assetUrl(logos?.team_home_logo ?? null);
                          const away = assetUrl(logos?.team_away_logo ?? null);

                          const matchText = m.match_name ?? m.dated_name ?? `Match ${m.match_id}`;
                          return (
                            <tr key={m.match_id}>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                                {m.match_date ? new Date(m.match_date).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                <Link href={`/matches/${m.match_id}`} style={{ color: '#111', fontWeight: 800, textDecoration: 'none' }}>
                                  {matchText}
                                </Link>
                              </td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{m.competition ?? '—'}</td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{m.venue ?? '—'}</td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{m.format ?? '—'}</td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      border: '1px solid #e5e5e5',
                                      background: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {home ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={home} alt="Home" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    ) : null}
                                  </div>
                                  <span style={{ color: '#666', fontWeight: 800 }}>vs</span>
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      border: '1px solid #e5e5e5',
                                      background: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {away ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={away} alt="Away" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Prize Pool Modal */}
      <Modal title="Prize Pool" open={prizeOpen} onClose={() => setPrizeOpen(false)} maxWidth={900}>
        {prizeLoading ? (
          <div style={{ color: '#555' }}>Loading prize pool…</div>
        ) : prizePoolRows.length === 0 ? (
          <div style={{ color: '#555', lineHeight: 1.5 }}>No prize pool rows available yet.</div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Rank</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Prize</th>
                </tr>
              </thead>
              <tbody>
                {prizePoolRows.map((r, idx) => {
                  const medal =
                    (r.rankStart === 1
                      ? 'https://fantasy-cricket-assets.vercel.app/assets/gold.png'
                      : r.rankStart === 2
                      ? 'https://fantasy-cricket-assets.vercel.app/assets/silver.png'
                      : r.rankStart === 3
                      ? 'https://fantasy-cricket-assets.vercel.app/assets/bronze.png'
                      : null) as string | null;

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {medal ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={medal} alt="" style={iconStyle} />
                          ) : null}
                          <span>{r.rankLabel}</span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          {r.displayParts.length === 0 ? (
                            <span>—</span>
                          ) : (
                            r.displayParts.map((p, i2) => {
                              if (p.type === 'CP') {
                                return (
                                  <span key={i2} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 900 }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={cpIconUrl} alt="CP" style={iconStyle} />
                                    {p.value}
                                  </span>
                                );
                              }
                              return (
                                <span key={i2} style={{ fontWeight: 800 }}>
                                  {p.value}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Leaderboard Modal */}
      <Modal title="Live Leaderboard" open={lbOpen} onClose={() => setLbOpen(false)} maxWidth={900}>
        {lbLoading ? (
          <div style={{ color: '#555' }}>Loading leaderboard…</div>
        ) : lbRows.length === 0 ? (
          <div style={{ color: '#555' }}>No leaderboard rows yet.</div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Rank</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>User</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Submission #</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Points</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {lbRows.map((r) => {
                  const isMe = meId ? r.user_id === meId : false;

                  const disp = userDisplayById.get(r.user_id)?.display_name ?? null;
                  const userHref = disp ? `/profile/${encodeURIComponent(disp)}` : null;

                  return (
                    <tr key={`${r.submission_id}-${r.rank}`} style={{ background: isMe ? '#f5f3ff' : '#fff' }}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900 }}>{r.rank}</td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {userHref ? (
                          <Link href={userHref} style={{ color: '#111', textDecoration: 'none', fontWeight: isMe ? 900 : 800 }}>
                            {disp}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: isMe ? 900 : 700 }}>{shortId(r.user_id)}</span>
                        )}
                        {isMe ? <span style={{ marginLeft: 8, fontSize: 12, color: '#6d28d9', fontWeight: 900 }}>(You)</span> : null}
                      </td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {canClickSubmission ? (
                          <Link href={`/play/${r.submission_id}`} style={{ color: '#111', fontWeight: 900, textDecoration: 'none' }}>
                            {r.submission_id}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 900 }}>{r.submission_id}</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6', fontWeight: 900 }}>{fmtPts(r.final_points)}</td>

                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {meId ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid #eee', background: '#fafafa' }}>
                <div style={{ fontWeight: 900 }}>Your expected prize</div>
                <div style={{ marginTop: 6, color: '#555', fontSize: 13 }}>
                  {previewRows.find((x) => x.user_id === meId && x.is_me)?.expected_prize_display ? (
                    <>
                      {previewRows.find((x) => x.user_id === meId && x.is_me)?.expected_prize_display}
                      <span style={{ marginLeft: 8, color: '#777' }}>(rank {previewRows.find((x) => x.user_id === meId && x.is_me)?.rank ?? '—'})</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
