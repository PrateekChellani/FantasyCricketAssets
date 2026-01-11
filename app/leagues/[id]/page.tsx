'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type LeagueDetailRow = {
  league_id: number;
  name: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  owner_user_id: string;
  owner_display_name: string | null;
  max_users: number | null;
  start_ts: string;
  end_ts: string;
  allowed_formats: string[] | null;
  update_policy: string | null;
  rules: any;
  created_at: string;
  active_members_count: number;
};

type LeagueMatchRow = {
  league_id: number;
  match_id: number;
  match_date: string;
  format: string;
  competition_id: number | null;
  competition: string | null;
  match_name: string;
  dated_name: string;
  venue: string | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
}

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = Number(params?.id);

  const [detail, setDetail] = useState<LeagueDetailRow | null>(null);
  const [matches, setMatches] = useState<LeagueMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const teamSize = useMemo(() => {
    const s = detail?.rules?.team_size;
    return typeof s === 'number' && s > 0 ? s : 11;
  }, [detail]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    const [dRes, mRes] = await Promise.all([
      supabase.from('v_league_detail_public').select('*').eq('league_id', leagueId).maybeSingle(),
      supabase.from('v_league_matches').select('*').eq('league_id', leagueId).order('match_date', { ascending: true }),
    ]);

    if (dRes.error) setErrorMsg(dRes.error.message);
    if (mRes.error) setErrorMsg((prev) => prev ?? mRes.error!.message);

    setDetail((dRes.data as any) ?? null);
    setMatches(((mRes.data as any) ?? []) as LeagueMatchRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!leagueId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 950 }}>{detail?.name ?? 'League'}</div>
          <div style={{ opacity: 0.8, marginTop: 6 }}>{detail?.description ?? '—'}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link
            href={`/leagues/${leagueId}/team`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.10)',
              fontWeight: 950,
            }}
          >
            Build / Edit My Team
          </Link>

          <Link
            href={`/leagues/${leagueId}/leaderboard`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              fontWeight: 900,
            }}
          >
            Leaderboard
          </Link>

          <Link
            href={`/leagues/${leagueId}/members`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              fontWeight: 900,
            }}
          >
            Members
          </Link>

          <Link
            href={`/leagues/${leagueId}/manage`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              fontWeight: 900,
            }}
          >
            Manage
          </Link>
        </div>
      </div>

      {(errorMsg || loading) && (
        <div style={{ marginTop: 14 }}>
          {loading && <div style={{ opacity: 0.8 }}>Loading…</div>}
          {errorMsg && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(255,70,70,0.35)',
                background: 'rgba(255,70,70,0.08)',
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {detail && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', opacity: 0.9, fontSize: 13 }}>
              <div>
                <b>Visibility:</b> {detail.visibility}
              </div>
              <div>
                <b>Owner:</b> {detail.owner_display_name ?? '—'}
              </div>
              <div>
                <b>Members:</b> {detail.active_members_count}
              </div>
              <div>
                <b>Dates:</b> {fmtDate(detail.start_ts)} → {fmtDate(detail.end_ts)}
              </div>
              <div>
                <b>Formats:</b> {detail.allowed_formats?.length ? detail.allowed_formats.join(', ') : 'All'}
              </div>
              <div>
                <b>Team size:</b> {teamSize}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                fontWeight: 950,
              }}
            >
              {expanded ? 'Hide Matches' : `Show Matches (${matches.length})`}
            </button>

            {expanded && (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {matches.length === 0 ? (
                  <div style={{ opacity: 0.75 }}>No matches in this league’s filters.</div>
                ) : (
                  matches.map((m) => (
                    <Link
                      key={m.match_id}
                      href={`/matches/${m.match_id}`}
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14,
                        padding: 12,
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 950 }}>{m.dated_name || m.match_name}</div>
                        <div style={{ opacity: 0.8, marginTop: 4, fontSize: 13 }}>
                          {m.competition ?? '—'} • {m.format} • {m.venue ?? '—'}
                        </div>
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 13, textAlign: 'right' }}>{m.match_date}</div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
