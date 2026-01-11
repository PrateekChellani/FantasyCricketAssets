'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type LeagueMemberRow = {
  league_id: number;
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  joined_at: string;
  status: string;
};

type LeagueMemberViewRow = {
  league_id: number;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  join_code?: string | null; // from v_leagues_member
  owner_user_id: string;
};

export default function LeagueManagePage() {
  const params = useParams();
  const leagueId = Number(params?.id);

  const [members, setMembers] = useState<LeagueMemberRow[]>([]);
  const [league, setLeague] = useState<LeagueMemberViewRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // kick flow
  const [kickUserId, setKickUserId] = useState<string | null>(null);
  const [kickNote, setKickNote] = useState<string>('');

  // delete flow
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteNote, setDeleteNote] = useState<string>(''); // REQUIRED by RPC

  const joinCode = useMemo(() => (league as any)?.join_code ?? null, [league]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    // League + join_code is member-protected (v_leagues_member)
    const lRes = await supabase
      .from('v_leagues_member')
      .select('league_id,name,visibility,join_code,owner_user_id')
      .eq('league_id', leagueId)
      .maybeSingle();

    if (lRes.error) setErrorMsg(lRes.error.message);
    setLeague((lRes.data as any) ?? null);

    const mRes = await supabase
      .from('v_league_members_member')
      .select('*')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true });

    if (mRes.error) setErrorMsg((prev) => prev ?? mRes.error!.message);
    setMembers((mRes.data as any) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!leagueId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function doKick() {
    if (!kickUserId) return;

    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const res = await supabase.rpc('kick_league_member', {
      p_league_id: leagueId,
      p_member_user_id: kickUserId,
      p_note: kickNote.trim() || null,
    });

    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }

    setInfoMsg('Member removed.');
    setKickUserId(null);
    setKickNote('');
    await load();
  }

  async function doDeleteLeague() {
    // Your RPC requires p_note
    const note = deleteNote.trim();
    if (!note) {
      setErrorMsg('Delete note is required.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const res = await supabase.rpc('delete_league', {
      p_league_id: leagueId,
      p_note: note,
    });

    setBusy(false);

    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }

    setInfoMsg('League deleted.');
    window.location.href = '/leagues';
  }

  return (
    <div style={{ padding: 18, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>Manage League</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Owner-only actions.</div>
        </div>
        <Link href={`/leagues/${leagueId}`} style={{ opacity: 0.9 }}>
          ← Back
        </Link>
      </div>

      {(loading || errorMsg || infoMsg) && (
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
          {infoMsg && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(80,200,120,0.35)',
                background: 'rgba(80,200,120,0.08)',
              }}
            >
              {infoMsg}
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 950 }}>Join Code</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
              Any existing league member can view this (as you requested).
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  fontWeight: 950,
                  letterSpacing: 1,
                }}
              >
                {joinCode ?? '—'}
              </div>
              <button
                onClick={async () => {
                  if (!joinCode) return;
                  try {
                    await navigator.clipboard.writeText(joinCode);
                    setInfoMsg('Copied join code!');
                  } catch {
                    setErrorMsg('Could not copy to clipboard (browser blocked).');
                  }
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                Copy
              </button>
            </div>

            <div style={{ opacity: 0.7, marginTop: 10, fontSize: 12 }}>
              Filters are locked after creation (start/end, formats, tournaments).
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 950 }}>Kick Member</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
              This requires confirmation + an optional note.
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {members.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No members found.</div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: 10,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <img
                        src={m.avatar_path ? `https://fantasy-cricket-assets.vercel.app/${m.avatar_path}` : '/public/logo.png'}
                        alt=""
                        style={{ width: 28, height: 28, borderRadius: 999, objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 950 }}>{m.display_name ?? 'User'}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{m.user_id}</div>
                      </div>
                    </div>

                    <button
                      disabled={busy}
                      onClick={() => {
                        setKickUserId(m.user_id);
                        setKickNote('');
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,70,70,0.10)',
                        cursor: 'pointer',
                        fontWeight: 950,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      Kick
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 950, color: 'rgba(255,120,120,0.95)' }}>Delete League</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
              Requires multiple confirmations + a required note.
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {deleteStep === 0 && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setDeleteStep(1);
                      setDeleteNote('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,70,70,0.10)',
                      cursor: 'pointer',
                      fontWeight: 950,
                    }}
                  >
                    Delete league…
                  </button>
                </div>
              )}

              {deleteStep === 1 && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 900, opacity: 0.9 }}>Are you sure?</div>
                  <button
                    disabled={busy}
                    onClick={() => setDeleteStep(2)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,70,70,0.14)',
                      cursor: 'pointer',
                      fontWeight: 950,
                    }}
                  >
                    Yes, continue
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setDeleteStep(0);
                      setDeleteNote('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {deleteStep === 2 && (
                <>
                  <div style={{ fontWeight: 950, opacity: 0.9 }}>Final confirmation:</div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>Delete note (required)</div>
                    <textarea
                      value={deleteNote}
                      onChange={(e) => setDeleteNote(e.target.value)}
                      rows={3}
                      placeholder="Required. Example: restarting season, created by mistake, etc."
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'inherit',
                        resize: 'vertical',
                      }}
                      disabled={busy}
                    />
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      This is passed to the RPC as <code>p_note</code>.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      disabled={busy || deleteNote.trim().length === 0}
                      onClick={doDeleteLeague}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: busy ? 'rgba(255,70,70,0.18)' : 'rgba(255,70,70,0.22)',
                        cursor: busy || deleteNote.trim().length === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 950,
                        opacity: busy || deleteNote.trim().length === 0 ? 0.6 : 1,
                      }}
                    >
                      {busy ? 'Deleting…' : 'Delete now'}
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => {
                        setDeleteStep(0);
                        setDeleteNote('');
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kick confirmation modal */}
      {kickUserId && (
        <div
          onClick={() => !busy && setKickUserId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(680px, 100%)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(20,20,20,0.95)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950 }}>Kick member?</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
              You are removing: <b>{kickUserId}</b>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Note (optional)</div>
              <textarea
                value={kickNote}
                onChange={(e) => setKickNote(e.target.value)}
                rows={3}
                placeholder="Why are you removing this member?"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                disabled={busy}
                onClick={() => setKickUserId(null)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 900,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={doKick}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,70,70,0.14)',
                  cursor: 'pointer',
                  fontWeight: 950,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Kicking…' : 'Confirm Kick'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
