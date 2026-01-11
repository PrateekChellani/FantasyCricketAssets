'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type TeamRow = {
  team_id: number;
  short_name: string | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;

  // these must exist in public.v_user_profiles after your SQL changes
  country_of_residence?: string | null;
  favorite_team_id?: number | null;
};

const RPC_UPDATE_PROFILE = 'update_my_profile';
const RPC_COMPLETE_ONBOARDING = 'complete_onboarding'; // NOTE: called on schema('app') below

function clampStr(v: string, max: number) {
  const s = (v ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Australia',
  'New Zealand',
  'South Africa',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'Afghanistan',
  'West Indies',
  'Nepal',
  'UAE',
  'Canada',
  'Other',
];

export default function OnboardingClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = decodeURIComponent(search.get('next') || '/');

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  // wizard
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [country, setCountry] = useState<string>('');

  // step 2
  const [newDisplayName, setNewDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [favoriteTeamId, setFavoriteTeamId] = useState<number | null>(null);

  const [teams, setTeams] = useState<TeamRow[]>([]);

  // step 3
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // UX
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  // -----------------------------
  // styling (matches your site)
  // -----------------------------
  const pageWrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '18px 16px' };

  const card: React.CSSProperties = {
    borderRadius: 16,
    background: '#fff',
    border: '1px solid #e5e5e5',
    boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
    overflow: 'hidden',
  };

  const cardPad: React.CSSProperties = { padding: 16 };

  const btnPrimary: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid #111',
    background: '#111',
    color: '#fff',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
  };

  const btnGhost: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid #e5e5e5',
    background: '#fff',
    color: '#111',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #e5e5e5',
    background: '#fff',
    fontSize: 14,
  };

  const select: React.CSSProperties = {
    ...input,
    appearance: 'none',
    background: '#fff',
  };

  // -----------------------------
  // load auth + profile
  // -----------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  async function loadProfile() {
    if (!userId) return;
    setLoading(true);
    setBanner(null);

    const { data, error } = await supabase
      .schema('public')
      .from('v_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setBanner({ kind: 'error', msg: `Failed to load profile: ${error.message}` });
      setLoading(false);
      return;
    }

    const p = (data as any) as UserProfileRow | null;
    setProfile(p);

    // hydrate fields (safe even if columns not yet present in the view)
    setNewDisplayName(p?.display_name ?? '');
    setCountry((p as any)?.country_of_residence ?? '');
    setFavoriteTeamId(((p as any)?.favorite_team_id ?? null) as number | null);

    setLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // load teams (only 1–10)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .schema('public')
        .from('teams')
        .select('team_id, short_name')
        .gte('team_id', 1)
        .lte('team_id', 10)
        .order('team_id', { ascending: true });

      if (!error) setTeams(((data as any) ?? []) as TeamRow[]);
    })();
  }, []);

  // avatar preview (public url)
  const avatarPublicUrl = useMemo(() => {
    if (!profile?.avatar_path) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path);
    return data.publicUrl ?? null;
  }, [profile?.avatar_path]);

  // -----------------------------
  // helpers
  // -----------------------------
  function canGoNextFromStep1() {
    return !!country;
  }

  function canGoNextFromStep2() {
    const dn = newDisplayName.trim();
    if (!dn || dn.length < 3 || dn.length > 30) return false;
    if (!favoriteTeamId) return false;
    return true;
  }

  function canContinueFromStep3() {
    return termsChecked;
  }

  function validateAvatarFile(f: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(f.type)) return 'Only PNG, JPG/JPEG, or WebP images are allowed.';
    const max = 5 * 1024 * 1024;
    if (f.size > max) return 'Max file size is 5 MB.';
    return null;
  }

  async function uploadAvatarIfNeeded(): Promise<string | null> {
    if (!userId) return null;
    if (!avatarFile) return profile?.avatar_path ?? null;

    const v = validateAvatarFile(avatarFile);
    if (v) throw new Error(v);

    const ext = avatarFile.type === 'image/png' ? 'png' : avatarFile.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
      upsert: true,
      contentType: avatarFile.type,
    });

    if (upErr) throw new Error(upErr.message);
    return path;
  }

  async function saveProfilePrefs() {
    setBanner(null);

    const dn = clampStr(newDisplayName, 30);
    if (!dn || dn.length < 3) throw new Error('Display name must be 3–30 characters.');
    if (!favoriteTeamId) throw new Error('Please select your favorite national team.');
    if (!country) throw new Error('Please select your country of residence.');

    const avatarPath = await uploadAvatarIfNeeded();

    // Assumes update_my_profile has been extended to accept these two params.
    const { error } = await supabase.rpc(RPC_UPDATE_PROFILE, {
      p_display_name: dn,
      p_avatar_path: avatarPath,
      p_country_of_residence: country,
      p_favorite_team_id: favoriteTeamId,
    } as any);

    if (error) throw new Error(error.message);
  }

  async function completeOnboarding() {
    setBanner(null);

    // 1) Save profile + prefs before completion
    await saveProfilePrefs();

    // 2) Complete onboarding in app schema (this grants starter packs after completion)
    // ✅ ONLY CHANGE: call the PUBLIC RPC (no schema('app'))
    const { error } = await supabase.rpc(RPC_COMPLETE_ONBOARDING, {} as any);
    if (error) throw new Error(error.message);

    setBanner({ kind: 'success', msg: 'Onboarding completed. Welcome!' });
    router.replace(next || '/');
  }

  // -----------------------------
  // render
  // -----------------------------
  if (!userId) {
    return (
      <div style={pageWrap}>
        <h1 style={{ margin: 0 }}>Onboarding</h1>
        <div style={{ marginTop: 14, ...card }}>
          <div style={cardPad}>
            Please <Link href="/sign-in">sign in</Link> to continue onboarding.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Onboarding</h1>
        <div style={{ fontSize: 13, color: '#666', fontWeight: 800 }}>
          {loading ? 'Loading…' : `Step ${step} of 3`}
        </div>
      </div>

      {banner ? (
        <div
          style={{
            marginTop: 12,
            background: banner.kind === 'error' ? '#fee2e2' : '#d1fae5',
            border: '1px solid #e5e5e5',
            padding: '10px 12px',
            borderRadius: 10,
          }}
        >
          {banner.msg}
        </div>
      ) : null}

      <div style={{ marginTop: 14, ...card }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee', background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>WELCOME</div>
          <div style={{ fontSize: 22, fontWeight: 950, marginTop: 4 }}>Welcome to Fantasy Cricket</div>
          <div style={{ marginTop: 6, color: '#444' }}>Complete onboarding to unlock your free starter pack.</div>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              width: '300%',
              transform: `translateX(${step === 1 ? '0%' : step === 2 ? '-33.3333%' : '-66.6666%'})`,
              transition: 'transform 220ms ease',
            }}
          >
            {/* STEP 1 */}
            <div style={{ width: '100%', padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Part 1: Basics</div>
              <div style={{ marginTop: 8, color: '#555' }}>Select your country of residence.</div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Country of Residence</div>
                <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...select, marginTop: 6 }}>
                  <option value="">Select a country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  style={{ ...btnPrimary, opacity: canGoNextFromStep1() ? 1 : 0.6, cursor: canGoNextFromStep1() ? 'pointer' : 'not-allowed' }}
                  disabled={!canGoNextFromStep1()}
                  onClick={() => setStep(2)}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* STEP 2 */}
            <div style={{ width: '100%', padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Part 2: Your Profile</div>
              <div style={{ marginTop: 8, color: '#555' }}>Update your display name + avatar, and choose your favorite national team.</div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '110px 1fr', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 16,
                    border: '1px solid #e5e5e5',
                    background: '#111',
                    color: '#fff',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 950,
                    fontSize: 28,
                  }}
                  title="Avatar"
                >
                  {avatarPublicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPublicUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span>{String(profile?.display_name ?? 'U').slice(0, 1).toUpperCase()}</span>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Display Name</div>
                    <input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      style={{ ...input, marginTop: 6 }}
                      placeholder="3–30 characters"
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>This is what other users will see.</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Avatar</div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                      style={{ marginTop: 6 }}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>PNG/JPG/WebP, max 5MB.</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>Select Your Favorite National Team</div>
                <select
                  value={favoriteTeamId ?? ''}
                  onChange={(e) => setFavoriteTeamId(e.target.value ? Number(e.target.value) : null)}
                  style={{ ...select, marginTop: 6 }}
                >
                  <option value="">Select a team…</option>
                  {teams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.short_name ?? `Team ${t.team_id}`}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>Only teams 1–10 are shown.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
                <button style={btnGhost} onClick={() => setStep(1)} disabled={busy}>
                  ← Previous
                </button>

                <button
                  style={{ ...btnPrimary, opacity: canGoNextFromStep2() && !busy ? 1 : 0.6, cursor: canGoNextFromStep2() && !busy ? 'pointer' : 'not-allowed' }}
                  disabled={!canGoNextFromStep2() || busy}
                  onClick={() => setStep(3)}
                >
                  Next →
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                Prefer the full profile page?{' '}
                <Link href="/profile" style={{ fontWeight: 900 }}>
                  Edit Profile
                </Link>
              </div>
            </div>

            {/* STEP 3 */}
            <div style={{ width: '100%', padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Part 3: Quick Tour</div>
              <div style={{ marginTop: 8, color: '#555' }}>Placeholders for now — you’ll replace this content later.</div>

              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 950 }}>Header Text A</div>
                  <div style={{ marginTop: 6, color: '#444' }}>Text A</div>
                </div>

                <div style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 950 }}>Header Text B</div>
                  <div style={{ marginTop: 6, color: '#444' }}>Text B</div>
                </div>

                <div style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 950 }}>Header Text C</div>
                  <div style={{ marginTop: 6, color: '#444' }}>Text C</div>
                </div>
              </div>

              <div style={{ marginTop: 14, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                  <input type="checkbox" checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    I have read and accept all{' '}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        color: '#111',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      Terms and Conditions
                    </button>
                    .
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
                <button style={btnGhost} onClick={() => setStep(2)} disabled={busy}>
                  ← Previous
                </button>

                <button
                  style={{
                    ...btnPrimary,
                    opacity: canContinueFromStep3() && !busy ? 1 : 0.6,
                    cursor: canContinueFromStep3() && !busy ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!canContinueFromStep3() || busy}
                  onClick={async () => {
                    setBusy(true);
                    setBanner(null);
                    try {
                      await completeOnboarding();
                    } catch (e: any) {
                      setBanner({ kind: 'error', msg: e?.message ? String(e.message) : 'Failed to complete onboarding.' });
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Completing…' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms modal */}
      {termsOpen ? (
        <div
          onClick={() => setTermsOpen(false)}
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
              width: 'min(720px, 100%)',
              borderRadius: 16,
              background: '#fff',
              border: '1px solid #e5e5e5',
              overflow: 'hidden',
              boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 950 }}>Terms &amp; Conditions</div>
              <button onClick={() => setTermsOpen(false)} style={btnGhost}>
                Close
              </button>
            </div>

            <div style={{ padding: 14, color: '#333' }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>T&amp;C Placeholder text</div>
              <div style={{ color: '#555' }}>Replace this with your actual Terms and Conditions later.</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
