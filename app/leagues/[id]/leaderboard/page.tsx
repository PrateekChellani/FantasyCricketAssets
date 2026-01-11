'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type LeaderRow = {
  league_id: number;
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  total_points: number | string | null;
  rank: number;
};

export default function LeagueLeaderboardPage() {
  const params = useParams();
  const leagueId = Number(params?.id);

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      const res = await supabase.from('v_league_leaderboard').select('*').eq('league_id', leagueId).order('rank');
      if (res.error) setErrorMsg(res.error.message);
      setRows((res.data as any) ?? []);
      setLoading(false);
    })();
  }, [leagueId]);

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>League Leaderboard</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Total points across all included matches.</div>
        </div>
        <Link href={`/leagues/${leagueId}`} style={{ opacity: 0.9 }}>
          ← Back
        </Link>
      </div>

      {loading && <div style={{ marginTop: 14, opacity: 0.8 }}>Loading…</div>}
      {errorMsg && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,70,70,0.35)',
            background: 'rgba(255,70,70,0.08)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 140px', padding: 12, opacity: 0.75 }}>
              <div>Rank</div>
              <div>User</div>
              <div style={{ textAlign: 'right' }}>Points</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }} />

            {rows.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75 }}>No members yet.</div>
            ) : (
              rows.map((r) => (
                <div
                  key={r.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr 140px',
                    padding: 12,
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontWeight: 950 }}>{r.rank}</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img
                      src={r.avatar_path ? `https://fantasy-cricket-assets.vercel.app/${r.avatar_path}` : '/public/logo.png'}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: 999, objectFit: 'cover' }}
                    />
                    <div style={{ fontWeight: 900 }}>{r.display_name ?? 'User'}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 950 }}>{r.total_points ?? 0}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
