'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type MemberRow = {
  league_id: number;
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  joined_at: string;
  status: string;
};

export default function LeagueMembersPage() {
  const params = useParams();
  const leagueId = Number(params?.id);

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // If the league is PUBLIC, you’ll see the public view. If PRIVATE, member view should work for members.
      // Prefer member-safe view which already enforces “must be member”.
      const res = await supabase
        .from('v_league_members_member')
        .select('*')
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true });

      if (res.error) {
        // fallback to public members (works for public leagues)
        const fallback = await supabase
          .from('v_league_members_public')
          .select('*')
          .eq('league_id', leagueId)
          .order('joined_at', { ascending: true });

        if (fallback.error) setErrorMsg(fallback.error.message);
        setRows((fallback.data as any) ?? []);
      } else {
        setRows((res.data as any) ?? []);
      }

      setLoading(false);
    })();
  }, [leagueId]);

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>Members</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Active members in this league.</div>
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
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', padding: 12, opacity: 0.75 }}>
              <div>User</div>
              <div style={{ textAlign: 'right' }}>Joined</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }} />
            {rows.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75 }}>No members found.</div>
            ) : (
              rows.map((r) => (
                <div
                  key={r.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px',
                    padding: 12,
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img
                      src={r.avatar_path ? `https://fantasy-cricket-assets.vercel.app/${r.avatar_path}` : '/public/logo.png'}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: 999, objectFit: 'cover' }}
                    />
                    <div style={{ fontWeight: 950 }}>{r.display_name ?? 'User'}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{r.status}</div>
                  </div>
                  <div style={{ textAlign: 'right', opacity: 0.85, fontSize: 13 }}>
                    {new Date(r.joined_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
