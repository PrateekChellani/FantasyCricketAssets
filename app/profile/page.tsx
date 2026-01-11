'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

type UserProfileRow = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  twitter: string | null;
  discord: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  suspended_at: string | null;
  suspended_till: string | null;
  competition_wins: number;
  referred_by: string | null;
};

type PackInstanceRow = {
  pack_instance_id: number;
  pack_template_id: number;
  user_id: string;
  status: string;
  purchased_at: string;
  opened_at: string | null;
  claimed_at: string | null;
};

type PackTemplateRow = {
  pack_template_id: number;
  name: string;
  kind: string;
  reveal_count: number;
  pick_count: number;
};

type PackRevealRow = {
  pack_instance_id: number;
  reveal_index: number;
  player_id: number;
  card_id: number | null;
};

type ScrapbookPlayerRow = {
  player_id: number;
  full_name: string | null;
  role: string | null;
  country_id: number | null;
  image: string | null;
};

type MyCardRow = {
  ownership_id: number;
  card_id: number;
  user_id: string;
  acquired_on: string;
  is_active: boolean;
  burned_on: string | null;
  is_current: boolean;

  player_id: number;
  card_type: string;
  edition: string | null;
  minted_on: string;
  points_earned: number;
  matches_selected: number;
  owners_count?: number | null;

  full_name: string;
  role: string | null;
  country_id: number | null;
  image: string | null;
  player_active: boolean | null;

  last_match_points?: number | null;
};

type TeamLookupRow = {
  team_id: number;
  short_name: string | null;
  name: string | null;
  logo: string | null;
};

type OverallPointScoreRow = Record<string, any>;

const GOOGLE_ICON = 'https://fantasy-cricket-assets.vercel.app/assets/google.png';
const DISCORD_ICON = 'https://fantasy-cricket-assets.vercel.app/assets/discord.png';
const X_ICON = 'https://fantasy-cricket-assets.vercel.app/assets/X.png';

type TabKey = 'profile' | 'password' | 'ledger' | 'packs' | 'refer' | 'delete';

function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  return `https://fantasy-cricket-assets.vercel.app/${path}`;
}

function fmtDT(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function badgeStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    color: '#111',
    border: '1px solid rgba(0,0,0,0.12)',
  };
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

function safeLower(v: any) {
  return String(v ?? '').toLowerCase();
}

function StatCard(props: { label: string; value: any; title?: string }) {
  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 14, padding: 12, background: '#fff' }} title={props.title ?? ''}>
      <div style={{ fontSize: 12, color: '#666' }}>{props.label}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 4 }}>{String(props.value)}</div>
    </div>
  );
}

function RowKV(props: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ color: '#666' }}>{props.label}</div>
      <div style={{ fontWeight: 800, textAlign: 'right' }}>{String(props.value)}</div>
    </div>
  );
}

/**
 * IMPORTANT:
 * Writes are done ONLY via PUBLIC RPCs (no app schema writes from the client).
 */
const RPC_UPDATE = 'update_my_profile';
const RPC_DELETE = 'delete_my_profile';

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('profile');

  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  // editable fields
  const [newDisplayName, setNewDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');

  // ✅ NEW: identities (for Discord link/unlink UI)
  const [identities, setIdentities] = useState<any[]>([]);
  const [discordBusy, setDiscordBusy] = useState(false);

  // avatar modal
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // password tab
  const [curPw, setCurPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // packs tab
  const [packs, setPacks] = useState<(PackInstanceRow & { template?: PackTemplateRow | null })[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsOffset, setPacksOffset] = useState(0);
  const [packOpenMap, setPackOpenMap] = useState<Record<number, boolean>>({});
  const [packRevealsByInstance, setPackRevealsByInstance] = useState<Record<number, PackRevealRow[]>>({});
  const [playersById, setPlayersById] = useState<Record<number, ScrapbookPlayerRow>>({});

  // ✅ NEW: card modal should match MyPlayers exactly
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardById, setCardById] = useState<Record<number, MyCardRow>>({});

  // team lookup (country_id -> teams)
  const [teamById, setTeamById] = useState<Record<number, TeamLookupRow>>({});
  // overall point scores (to show last match points like MyPlayers modal)
  const [overallScores, setOverallScores] = useState<OverallPointScoreRow[]>([]);

  // refer tab
  const [refCopiedToast, setRefCopiedToast] = useState<string | null>(null);
  const [referredUsers, setReferredUsers] = useState<UserProfileRow[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  // delete tab
  const [delText, setDelText] = useState('');
  const [delChecked, setDelChecked] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    })();
  }, []);

  async function loadIdentities() {
    setBanner(null);
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      setIdentities([]);
      setBanner({ kind: 'error', msg: `Failed to load connected accounts: ${error.message}` });
      return;
    }
    setIdentities((((data as unknown) as { identities?: any[] })?.identities ?? []) as any[]);
  }

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
      setBanner({ kind: 'error', msg: `Failed to load profile: ${error.message}` });
      setProfile(null);
      setLoading(false);
      return;
    }

    const p = (data as any) as UserProfileRow | null;
    setProfile(p);
    setNewDisplayName(p?.display_name ?? '');
    setBio(p?.bio ?? '');
    setTwitter(p?.twitter ?? '');
    setDiscord(p?.discord ?? '');
    setLoading(false);

    // ✅ NEW: refresh identities whenever profile loads
    await loadIdentities();
  }

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const avatarPublicUrl = useMemo(() => {
    if (!profile?.avatar_path) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path);
    return data.publicUrl ?? null;
  }, [profile?.avatar_path]);

  async function rpcUpdate(payload: {
    p_display_name?: string | null;
    p_bio?: string | null;
    p_twitter?: string | null;
    p_discord?: string | null;
    p_avatar_path?: string | null;
  }) {
    setBanner(null);
    const { error } = await supabase.rpc(RPC_UPDATE, payload);
    if (error) {
      setBanner({ kind: 'error', msg: error.message });
      return false;
    }
    return true;
  }

  async function saveDisplayName() {
    const dn = newDisplayName.trim();
    if (!dn) return setBanner({ kind: 'error', msg: 'Display name cannot be empty.' });
    if (dn.length < 3 || dn.length > 30) return setBanner({ kind: 'error', msg: 'Display name must be 3–30 characters.' });

    const ok = await rpcUpdate({ p_display_name: dn });
    if (!ok) return;
    setBanner({ kind: 'success', msg: 'Display name updated.' });
    await loadProfile();
  }

  async function saveBio() {
    const next = bio.trim();
    if (next.length > 280) return setBanner({ kind: 'error', msg: 'Bio must be 280 characters or less.' });

    const ok = await rpcUpdate({ p_bio: next });
    if (!ok) return;
    setBanner({ kind: 'success', msg: 'Bio updated.' });
    await loadProfile();
  }

  async function saveSocials() {
    const tw = twitter.trim() || null;
    const dc = discord.trim() || null;

    if (tw && tw.length > 200) return setBanner({ kind: 'error', msg: 'Twitter/X link is too long.' });
    if (dc && dc.length > 200) return setBanner({ kind: 'error', msg: 'Discord value is too long.' });

    const ok = await rpcUpdate({ p_twitter: tw, p_discord: dc });
    if (!ok) return;
    setBanner({ kind: 'success', msg: 'Social profiles updated.' });
    await loadProfile();
  }

  // ✅ NEW: Phase 1 for X — store a manually-entered handle in profile.twitter
  function normalizeXHandle(v: string) {
    let s = (v ?? '').trim();
    if (!s) return '';
    s = s.replace(/^https?:\/\/(www\.)?x\.com\//i, '');
    s = s.replace(/^https?:\/\/(www\.)?twitter\.com\//i, '');
    s = s.replace(/^@+/, '');
    s = s.replace(/\s+/g, '');
    return s;
  }

  async function saveXHandle() {
    const h = normalizeXHandle(twitter);
    if (h && h.length > 50) return setBanner({ kind: 'error', msg: 'X handle is too long.' });

    const ok = await rpcUpdate({ p_twitter: h || null });
    if (!ok) return;
    setBanner({ kind: 'success', msg: 'X handle updated.' });
    await loadProfile();
  }

  const discordIdentity = useMemo(() => {
    return (identities ?? []).find((i: any) => safeLower(i?.provider) === 'discord') ?? null;
  }, [identities]);

  const isDiscordLinked = !!discordIdentity;

  async function linkDiscord() {
    setBanner(null);
    setDiscordBusy(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.href : undefined;
      const { error } = await supabase.auth.linkIdentity({
        provider: 'discord',
        options: redirectTo ? { redirectTo } : undefined,
      } as any);

      if (error) {
        setBanner({ kind: 'error', msg: `Failed to link Discord: ${error.message}` });
        return;
      }

      // Most flows will redirect; if not, refresh identities just in case.
      await loadIdentities();
      setBanner({ kind: 'success', msg: 'Discord link started. Complete it in the pop-up/redirect.' });
    } finally {
      setDiscordBusy(false);
    }
  }

  async function unlinkDiscord() {
    setBanner(null);
    if (!discordIdentity) return;

    // Supabase requires at least 2 identities to unlink one
    if ((identities?.length ?? 0) < 2) {
      return setBanner({ kind: 'error', msg: 'You must have at least 2 connected sign-in methods before unlinking Discord.' });
    }

    setDiscordBusy(true);
    try {
      const { error } = await supabase.auth.unlinkIdentity(discordIdentity);
      if (error) {
        setBanner({ kind: 'error', msg: `Failed to unlink Discord: ${error.message}` });
        return;
      }

      await loadIdentities();
      setBanner({ kind: 'success', msg: 'Discord unlinked.' });
    } finally {
      setDiscordBusy(false);
    }
  }

  function validateAvatarFile(f: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(f.type)) return 'Only PNG, JPG/JPEG, or WebP images are allowed.';
    const max = 5 * 1024 * 1024;
    if (f.size > max) return 'Max file size is 5 MB.';
    return null;
  }

  async function uploadAvatar() {
    if (!userId) return;
    setAvatarErr(null);
    setBanner(null);

    if (!avatarFile) return setAvatarErr('Please choose an image file.');

    const v = validateAvatarFile(avatarFile);
    if (v) return setAvatarErr(v);

    setAvatarBusy(true);
    try {
      const ext = avatarFile.type === 'image/png' ? 'png' : avatarFile.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
      });

      if (upErr) return setAvatarErr(upErr.message);

      const ok = await rpcUpdate({ p_avatar_path: path });
      if (!ok) return;

      setBanner({ kind: 'success', msg: 'Avatar updated.' });
      setAvatarOpen(false);
      setAvatarFile(null);
      await loadProfile();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function updatePassword() {
    setBanner(null);
    if (!email) return setBanner({ kind: 'error', msg: 'No email found for this account.' });
    if (!curPw || !newPw1 || !newPw2) return setBanner({ kind: 'error', msg: 'Please fill all password fields.' });
    if (newPw1 !== newPw2) return setBanner({ kind: 'error', msg: 'New passwords do not match.' });
    if (newPw1.length < 8) return setBanner({ kind: 'error', msg: 'New password must be at least 8 characters.' });

    setPwBusy(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: curPw });
      if (signInErr) return setBanner({ kind: 'error', msg: 'Current password is incorrect.' });

      const { error: upErr } = await supabase.auth.updateUser({ password: newPw1 });
      if (upErr) return setBanner({ kind: 'error', msg: `Failed to update password: ${upErr.message}` });

      setBanner({ kind: 'success', msg: 'Password updated.' });
      setCurPw('');
      setNewPw1('');
      setNewPw2('');
    } finally {
      setPwBusy(false);
    }
  }

  async function resetPasswordEmail() {
    setBanner(null);
    if (!email) return setBanner({ kind: 'error', msg: 'No email found for this account.' });

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return setBanner({ kind: 'error', msg: `Failed to send reset email: ${error.message}` });

    setBanner({ kind: 'success', msg: 'Password Reset link has been sent to associated email' });
  }

  async function loadMorePacks(reset = false) {
    if (!userId) return;
    setPacksLoading(true);
    setBanner(null);

    const limit = 15;
    const offset = reset ? 0 : packsOffset;

    const { data: pi, error: piErr } = await supabase
      .schema('public')
      .from('v_pack_instances')
      .select('pack_instance_id, pack_template_id, user_id, status, purchased_at, opened_at, claimed_at')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (piErr) {
      setBanner({ kind: 'error', msg: `Failed to load pack history: ${piErr.message}` });
      setPacksLoading(false);
      return;
    }

    const next = ((pi as any) ?? []) as PackInstanceRow[];

    const templateIds = Array.from(new Set(next.map((x) => x.pack_template_id).filter((x) => typeof x === 'number')));
    let templates: PackTemplateRow[] = [];
    if (templateIds.length > 0) {
      const { data: pt, error: ptErr } = await supabase
        .schema('public')
        .from('pack_templates')
        .select('pack_template_id, name, kind, reveal_count, pick_count')
        .in('pack_template_id', templateIds);

      if (!ptErr) templates = ((pt as any) ?? []) as PackTemplateRow[];
    }

    const tmap = new Map<number, PackTemplateRow>();
    templates.forEach((t) => tmap.set(t.pack_template_id, t));

    const merged = next.map((x) => ({ ...x, template: tmap.get(x.pack_template_id) ?? null }));

    if (reset) {
      setPacks(merged);
      setPacksOffset(limit);
    } else {
      setPacks((prev) => [...prev, ...merged]);
      setPacksOffset(offset + limit);
    }

    setPacksLoading(false);
  }

  async function ensurePackRevealsLoaded(pack_instance_id: number) {
    if (packRevealsByInstance[pack_instance_id]) return;

    const { data, error } = await supabase
      .schema('public')
      .from('v_pack_instance_reveals')
      .select('pack_instance_id, reveal_index, player_id, card_id')
      .eq('pack_instance_id', pack_instance_id)
      .order('reveal_index', { ascending: true });

    if (error) {
      setBanner({ kind: 'error', msg: `Failed to load pack reveals: ${error.message}` });
      setPackRevealsByInstance((m) => ({ ...m, [pack_instance_id]: [] }));
      return;
    }

    const reveals = (((data as any) ?? []) as PackRevealRow[]) ?? [];
    setPackRevealsByInstance((m) => ({ ...m, [pack_instance_id]: reveals }));

    const pids = Array.from(new Set(reveals.map((r) => r.player_id).filter((x) => typeof x === 'number')));
    const missing = pids.filter((id) => !playersById[id]);

    if (missing.length > 0) {
      const { data: pd, error: pdErr } = await supabase
        .schema('public')
        .from('v_team_scrapbook_players')
        .select('player_id, full_name, role, country_id, image')
        .in('player_id', missing);

      if (!pdErr) {
        const nextMap: Record<number, ScrapbookPlayerRow> = { ...playersById };
        for (const r of ((pd as any[]) ?? []) as ScrapbookPlayerRow[]) {
          nextMap[r.player_id] = r;
        }
        setPlayersById(nextMap);
      }
    }
  }

  useEffect(() => {
    if (!userId) return;
    if (tab !== 'packs') return;
    if (packs.length > 0) return;
    loadMorePacks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  async function loadReferredUsers() {
    if (!userId) return;
    setRefLoading(true);
    setBanner(null);

    const { data, error } = await supabase
      .schema('public')
      .from('v_user_profiles')
      .select('*')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setBanner({ kind: 'error', msg: `Failed to load referred users: ${error.message}` });
      setReferredUsers([]);
      setRefLoading(false);
      return;
    }

    setReferredUsers((((data as any) ?? []) as UserProfileRow[]) ?? []);
    setRefLoading(false);
  }

  useEffect(() => {
    if (!userId) return;
    if (tab !== 'refer') return;
    loadReferredUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const referralLink = useMemo(() => {
    const dn = (profile?.display_name ?? '').trim();
    if (!dn) return '';
    return `https://fantasy-cricket-psi.vercel.app/sign-up?ref=${encodeURIComponent(dn)}`;
  }, [profile?.display_name]);

  async function copyReferralLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setRefCopiedToast('Referral Link Copied.');
      setTimeout(() => setRefCopiedToast(null), 2200);
    } catch {
      setBanner({ kind: 'error', msg: 'Failed to copy link.' });
    }
  }

  function shareOnX() {
    if (!referralLink) return;
    const text = `I am inviting you to play fantasy cricket with me. ${referralLink}`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function deleteMyProfile() {
    if (!userId) return;
    setBanner(null);

    if (delText.trim() !== 'delete-my-profile') return setBanner({ kind: 'error', msg: "Type exactly 'delete-my-profile' to confirm deletion." });
    if (!delChecked) return setBanner({ kind: 'error', msg: 'You must check the authorization checkbox.' });

    setDelBusy(true);
    try {
      const { error } = await supabase.rpc(RPC_DELETE, {});
      if (error) return setBanner({ kind: 'error', msg: `Failed to delete profile: ${error.message}` });

      await supabase.auth.signOut();
      setBanner({ kind: 'success', msg: 'Your profile has been deleted.' });
      setUserId(null);
      setProfile(null);
    } finally {
      setDelBusy(false);
    }
  }

  // ----------------------------
  // ✅ NEW: MyPlayers-style modal helpers
  // ----------------------------

  const scoreByPlayerId = useMemo(() => {
    const m = new Map<number, OverallPointScoreRow>();
    for (const r of overallScores) {
      const pid = Number(r['Player ID']);
      if (Number.isFinite(pid) && !m.has(pid)) m.set(pid, r);
    }
    return m;
  }, [overallScores]);

  function pointsDisplayForPlayer(playerId: number | null | undefined, mode: 'avg' | 'last') {
    const base = {
      label: mode === 'avg' ? 'Avg pts / game:' : 'Last match pts:',
      value: '—',
      title: '',
    };

    if (!playerId) return base;

    const r = scoreByPlayerId.get(Number(playerId));
    if (!r) return base;

    if (mode === 'avg') {
      const title = `Bat: ${fmtPts(r['Average Batting Points per game'])} | Bowl: ${fmtPts(
        r['Average Bowling Points per game']
      )} | Field: ${fmtPts(r['Average Fielding Points per game'])} | Misc: ${fmtPts(r['Average Misc. points per game'])}`;
      return {
        label: 'Avg pts / game:',
        value: fmtPts(r['Average points per game']),
        title,
      };
    }

    const title = `Bat: ${fmtPts(r['Batting points in last game'])} | Bowl: ${fmtPts(r['Bowling points in last game'])} | Field: ${fmtPts(
      r['Fielding points in last game']
    )} | Misc: ${fmtPts(r['Misc points last game'])}`;
    return {
      label: 'Last match pts:',
      value: fmtPts(r['Points in last game']),
      title,
    };
  }

  const selected = useMemo(() => {
    if (!selectedCardId) return null;
    return cardById[selectedCardId] ?? null;
  }, [cardById, selectedCardId]);

  const selectedTeam = selected?.country_id ? teamById[selected.country_id] : undefined;
  const selectedNationName = selectedTeam?.name ?? selectedTeam?.short_name ?? (selected?.country_id ?? '—');
  const selectedTeamLogoUrl = assetUrl(selectedTeam?.logo ?? null);
  const selectedPlayerImageUrl = assetUrl(selected?.image ?? null);

  async function openModalForCard(cardId: number) {
    setBanner(null);

    setSelectedCardId(cardId);
    setIsModalOpen(true);

    // 1) Ensure we have the card row (from public.v_my_player_cards)
    if (!cardById[cardId]) {
      const { data, error } = await supabase
        .schema('public')
        .from('v_my_player_cards')
        .select(
          `
          ownership_id,
          card_id,
          user_id,
          acquired_on,
          is_active,
          burned_on,
          is_current,
          player_id,
          card_type,
          edition,
          minted_on,
          points_earned,
          matches_selected,
          owners_count,
          full_name,
          role,
          country_id,
          image,
          player_active
        `
        )
        .eq('card_id', cardId)
        .maybeSingle();

      if (error) {
        setBanner({ kind: 'error', msg: `Failed to load card details: ${error.message}` });
      } else if (data) {
        const row = (data as any) as MyCardRow;
        setCardById((m) => ({ ...m, [cardId]: row }));

        // 2) Ensure we have team lookup for this card's country_id
        const cid = row.country_id;
        if (typeof cid === 'number' && !teamById[cid]) {
          const { data: tdata, error: terr } = await supabase
            .schema('public')
            .from('teams')
            .select('team_id, short_name, name, logo')
            .in('team_id', [cid]);

          if (!terr) {
            const map: Record<number, TeamLookupRow> = { ...teamById };
            for (const tr of (tdata as any[]) ?? []) {
              if (typeof tr.team_id === 'number') map[tr.team_id] = tr as TeamLookupRow;
            }
            setTeamById(map);
          }
        }
      }
    }

    // 3) Ensure overall scores are loaded (for last match pts)
    if (overallScores.length === 0) {
      const { data: scores, error: scoreErr } = await supabase.schema('public').from('v_player_overall_point_scores').select('*');
      if (!scoreErr) setOverallScores(((scores as any) ?? []) as OverallPointScoreRow[]);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  // ----------------------------

  const pageWrap: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '18px 16px' };
  const shell: React.CSSProperties = {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: 14,
    alignItems: 'start',
  };
  const menuBox: React.CSSProperties = {
    borderRadius: 16,
    background: '#0b0b0b',
    color: '#fff',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.08)',
  };
  const menuItem = (active: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: active ? '#fbbf24' : '#fff',
    fontWeight: 900,
    cursor: 'pointer',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  });

  const contentBox: React.CSSProperties = {
    borderRadius: 16,
    background: '#fff',
    border: '1px solid #e5e5e5',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
    minHeight: 640,
  };

  if (!userId) {
    return (
      <div style={pageWrap}>
        <h1 style={{ margin: 0 }}>Your Profile</h1>
        <div style={{ marginTop: 18, padding: 14, border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff' }}>
          Please Log-in to see this page
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <h1 style={{ margin: 0 }}>Your Profile</h1>

      {banner && (
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
      )}

      <div style={shell}>
        {/* LEFT MENU */}
        <div style={menuBox}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            {profile?.display_name ? (
            <Link
              href={`/profile/${encodeURIComponent(profile.display_name)}`}
              style={{ fontSize: 16, fontWeight: 900, color: '#fff', textDecoration: 'none' }}
            >
            My Profile
          </Link>
          ) : (
    <div style={{ fontSize: 16, fontWeight: 900 }}>My Profile</div>
  )}
</div>


          <button style={menuItem(tab === 'profile')} onClick={() => setTab('profile')}>
            Profile Settings
          </button>
          <button style={menuItem(tab === 'password')} onClick={() => setTab('password')}>
            Password
          </button>

          <Link
            href="/profile/ledger"
            style={{
              display: 'block',
              padding: '12px 14px',
              textDecoration: 'none',
              color: tab === 'ledger' ? '#fbbf24' : '#fff',
              fontWeight: 900,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: tab === 'ledger' ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
            onClick={() => setTab('ledger')}
          >
            Cover Points Ledger
          </Link>

          <button style={menuItem(tab === 'packs')} onClick={() => setTab('packs')}>
            My Pack History
          </button>
          <button style={menuItem(tab === 'refer')} onClick={() => setTab('refer')}>
            Refer a User
          </button>
          <button style={menuItem(tab === 'delete')} onClick={() => setTab('delete')}>
            Delete My Profile
          </button>
        </div>

        {/* RIGHT CONTENT */}
        <div style={contentBox}>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ opacity: 0.9 }}>Loading…</div>
            ) : !profile ? (
              <div style={{ opacity: 0.9 }}>No profile found.</div>
            ) : tab === 'profile' ? (
              <>
                {/* Header strip (avatar + name + last login under it) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr',
                    gap: 14,
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e5e5e5',
                    background: '#fff',
                  }}
                >
                  {/* Avatar */}
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarErr(null);
                      setAvatarOpen(true);
                    }}
                    title="Update avatar"
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 16,
                      border: '1px solid #e5e5e5',
                      background: '#111',
                      color: '#fff',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {avatarPublicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPublicUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                        {String(profile.display_name ?? 'U').trim().slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        transition: 'opacity 120ms ease',
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                      className="avatar-hover"
                    >
                      ✎
                    </div>
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile.display_name}
                    </div>
                    <div style={{ marginTop: 6, color: '#666', fontSize: 13 }}>
                      Last Logged-in: <b>{fmtDT(profile.last_login_at)}</b>
                    </div>
                  </div>
                </div>

                {/* Change display name + email (single box, stacked) */}
                <div
                  style={{
                    marginTop: 14,
                    border: '1px solid #e5e5e5',
                    borderRadius: 14,
                    padding: 14,
                    background: '#fff',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666' }}>Change Display Name</div>
                  <input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #e5e5e5',
                      background: '#f3f4f6',
                      fontWeight: 800,
                    }}
                  />

                  <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Email</div>
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #e5e5e5',
                      background: '#f3f4f6',
                      fontWeight: 800,
                      color: '#111',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={email ?? ''}
                  >
                    {email ?? '—'}
                  </div>

                  <button
                    type="button"
                    onClick={saveDisplayName}
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      border: '1px solid #111',
                      background: '#111',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                      width: 'fit-content',
                    }}
                  >
                    Confirm New Display Name
                  </button>
                </div>

                {/* Bio */}
                <div style={{ marginTop: 14, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Bio</div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell people a bit about you…"
                    style={{
                      marginTop: 10,
                      width: '100%',
                      minHeight: 120,
                      borderRadius: 12,
                      border: '1px solid #e5e5e5',
                      padding: 10,
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveBio}
                    style={{
                      marginTop: 10,
                      borderRadius: 12,
                      border: '1px solid #111',
                      background: '#111',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    Update Bio
                  </button>
                </div>

                {/* Socials */}
                <div style={{ marginTop: 14, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Social Media</div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                    {/* ✅ Phase 1 for X: manual handle with Save button */}
                    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'start' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={X_ICON} alt="X" style={{ width: 24, height: 24, marginTop: 6 }} />
                      <div>
                        <div style={{ fontSize: 12, color: '#666' }}>X handle</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 6, alignItems: 'center' }}>
                          <input
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="@yourhandle"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e5e5', background: '#fff' }}
                          />
                          <button
                            type="button"
                            onClick={saveXHandle}
                            style={{
                              borderRadius: 12,
                              border: '1px solid #111',
                              background: '#111',
                              color: '#fff',
                              padding: '10px 12px',
                              cursor: 'pointer',
                              fontWeight: 900,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Save
                          </button>
                        </div>

                        {profile.twitter ? (
                          <div style={{ marginTop: 6, fontSize: 12 }}>
                            Saved: <span style={{ fontWeight: 900 }}>@{normalizeXHandle(profile.twitter)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* ✅ Discord: link/unlink buttons (OAuth) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={DISCORD_ICON} alt="Discord" style={{ width: 24, height: 24 }} />
                      <div>
                        <div style={{ fontSize: 12, color: '#666' }}>Discord</div>

                        <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          {isDiscordLinked ? <span style={badgeStyle('#bbf7d0')}>Connected</span> : <span style={badgeStyle('#fde68a')}>Not connected</span>}

                          {isDiscordLinked ? (
                            <button
                              type="button"
                              onClick={unlinkDiscord}
                              disabled={discordBusy}
                              style={{
                                borderRadius: 12,
                                border: '1px solid #e5e5e5',
                                background: '#fff',
                                color: '#111',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                fontWeight: 900,
                              }}
                            >
                              {discordBusy ? 'Working…' : 'Unlink Discord'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={linkDiscord}
                              disabled={discordBusy}
                              style={{
                                borderRadius: 12,
                                border: '1px solid #111',
                                background: '#111',
                                color: '#fff',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                fontWeight: 900,
                              }}
                            >
                              {discordBusy ? 'Working…' : 'Link Discord'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={loadIdentities}
                            style={{
                              borderRadius: 12,
                              border: '1px solid #e5e5e5',
                              background: '#fff',
                              color: '#111',
                              padding: '10px 12px',
                              cursor: 'pointer',
                              fontWeight: 900,
                            }}
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={GOOGLE_ICON} alt="Google" style={{ width: 24, height: 24 }} />
                      <div>
                        <div style={{ fontSize: 12, color: '#666' }}>Google</div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>Connected</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : tab === 'password' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 950 }}>Password</div>

                <div style={{ marginTop: 12, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Current Password</div>
                  <input
                    type="password"
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e5e5' }}
                  />

                  <div style={{ fontSize: 12, color: '#666' }}>New Password</div>
                  <input
                    type="password"
                    value={newPw1}
                    onChange={(e) => setNewPw1(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e5e5' }}
                  />

                  <div style={{ fontSize: 12, color: '#666' }}>Confirm New Password</div>
                  <input
                    type="password"
                    value={newPw2}
                    onChange={(e) => setNewPw2(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e5e5' }}
                  />

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={updatePassword}
                      disabled={pwBusy}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #111',
                        background: '#111',
                        color: '#fff',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      {pwBusy ? 'Updating…' : 'Update Password'}
                    </button>

                    <button
                      type="button"
                      onClick={resetPasswordEmail}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #e5e5e5',
                        background: '#fff',
                        color: '#111',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </>
            ) : tab === 'packs' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 950 }}>My Pack History</div>

                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {packs.length === 0 && !packsLoading ? <div style={{ opacity: 0.8 }}>No packs found.</div> : null}

                  {packs.map((p) => {
                    const name = p.template?.name ?? `Pack #${p.pack_template_id}`;
                    const opened = p.opened_at ?? p.claimed_at ?? p.purchased_at;
                    const isOpen = !!packOpenMap[p.pack_instance_id];
                    const reveals = packRevealsByInstance[p.pack_instance_id];

                    return (
                      <div key={p.pack_instance_id} style={{ border: '1px solid #e5e5e5', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = !isOpen;
                            setPackOpenMap((m) => ({ ...m, [p.pack_instance_id]: next }));
                            if (next) await ensurePackRevealsLoaded(p.pack_instance_id);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: 12,
                            border: 'none',
                            background: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 950 }}>
                              {name} ({p.pack_instance_id})
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Opened at {fmtDT(opened)}</div>
                          </div>
                          <div style={{ fontWeight: 900 }}>{isOpen ? '▾' : '▸'}</div>
                        </button>

                        {isOpen ? (
                          <div style={{ borderTop: '1px solid #eee', padding: 12 }}>
                            {reveals === undefined ? (
                              <div style={{ opacity: 0.8 }}>Loading…</div>
                            ) : reveals.length === 0 ? (
                              <div style={{ opacity: 0.8 }}>No reveals found for this pack.</div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                                {reveals.map((r) => {
                                  const pl = playersById[r.player_id];
                                  const img = assetUrl(pl?.image ?? null);

                                  return (
                                    <button
                                      key={`${r.pack_instance_id}-${r.reveal_index}`}
                                      onClick={() => {
                                        if (r.card_id) openModalForCard(r.card_id);
                                      }}
                                      style={{
                                        textAlign: 'left',
                                        borderRadius: 14,
                                        border: '1px solid #e5e5e5',
                                        background: '#fff',
                                        padding: 10,
                                        cursor: r.card_id ? 'pointer' : 'not-allowed',
                                        display: 'grid',
                                        gap: 8,
                                        opacity: r.card_id ? 1 : 0.6,
                                      }}
                                      title={r.card_id ? 'View Card Details' : 'No card_id for this reveal'}
                                    >
                                      <div
                                        style={{
                                          width: '100%',
                                          aspectRatio: '1 / 1',
                                          borderRadius: 12,
                                          background: '#111',
                                          border: '1px solid rgba(0,0,0,0.10)',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        {img ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={img} alt={pl?.full_name ?? 'Player'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        ) : (
                                          <div style={{ color: '#fff', fontSize: 12, opacity: 0.8 }}>IMG</div>
                                        )}
                                      </div>

                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {pl?.full_name ?? `Player ${r.player_id}`}
                                        </div>
                                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{pl?.role ?? '—'}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => loadMorePacks(false)}
                    disabled={packsLoading}
                    style={{
                      width: 'fit-content',
                      borderRadius: 12,
                      border: '1px solid #e5e5e5',
                      background: '#fff',
                      color: '#111',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    {packsLoading ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              </>
            ) : tab === 'refer' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 950 }}>Refer a User</div>

                {refCopiedToast ? (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: '#d1fae5', border: '1px solid #e5e5e5', fontSize: 13 }}>
                    {refCopiedToast}
                  </div>
                ) : null}

                <div style={{ marginTop: 12, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Your referral link</div>
                  <div
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #e5e5e5',
                      background: '#f3f4f6',
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={referralLink}
                  >
                    {referralLink || '—'}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={shareOnX}
                      style={{ borderRadius: 12, border: '1px solid #e5e5e5', background: '#fff', padding: '10px 12px', cursor: 'pointer', fontWeight: 900 }}
                    >
                      Share on X.com
                    </button>

                    <button
                      type="button"
                      onClick={copyReferralLink}
                      style={{ borderRadius: 12, border: '1px solid #111', background: '#111', color: '#fff', padding: '10px 12px', cursor: 'pointer', fontWeight: 900 }}
                    >
                      Copy Link
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Referred Users</div>

                  {refLoading ? (
                    <div style={{ marginTop: 10, opacity: 0.8 }}>Loading…</div>
                  ) : referredUsers.length === 0 ? (
                    <div style={{ marginTop: 10, opacity: 0.8 }}>No referred users yet.</div>
                  ) : (
                    <div style={{ marginTop: 10, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #eee' }}>Display name</th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #eee' }}>Created on</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referredUsers.map((u) => (
                            <tr key={u.user_id}>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', fontWeight: 900 }}>{u.display_name}</td>
                              <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{fmtDT(u.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : tab === 'delete' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 950 }}>Delete My Profile</div>
                <div style={{ marginTop: 8, color: '#444' }}>Are you sure you want to delete your profile? This Action cannot be undone.</div>

                <div style={{ marginTop: 12, border: '1px solid #e5e5e5', borderRadius: 14, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 950 }}>
                    Type <code>delete-my-profile</code> to confirm deletion
                  </div>
                  <input
                    value={delText}
                    onChange={(e) => setDelText(e.target.value)}
                    style={{ marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e5e5' }}
                  />

                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                    <input type="checkbox" checked={delChecked} onChange={(e) => setDelChecked(e.target.checked)} />
                    I authorize deleting my account, and recognize I will not be able to reclaim this.
                  </label>

                  <button
                    type="button"
                    onClick={deleteMyProfile}
                    disabled={delBusy}
                    style={{
                      marginTop: 12,
                      borderRadius: 12,
                      border: '1px solid #ef4444',
                      background: '#ef4444',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    {delBusy ? 'Deleting…' : 'Delete Profile'}
                  </button>
                </div>
              </>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>

      {/* AVATAR MODAL */}
      {avatarOpen ? (
        <div
          onClick={() => setAvatarOpen(false)}
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
              <div style={{ fontWeight: 950 }}>Update Avatar</div>
              <button
                onClick={() => setAvatarOpen(false)}
                style={{
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {avatarErr ? (
                <div style={{ marginBottom: 10, background: '#fee2e2', border: '1px solid #e5e5e5', padding: '10px 12px', borderRadius: 10 }}>
                  {avatarErr}
                </div>
              ) : null}

              <div style={{ fontSize: 13, color: '#444' }}>
                Upload PNG, JPEG, or WebP. Max 5 MB. Stored as <b>avatars/{userId}/avatar.*</b>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setAvatarFile(f);
                  setAvatarErr(null);
                }}
                style={{ marginTop: 10 }}
              />

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={uploadAvatar}
                  disabled={avatarBusy}
                  style={{
                    borderRadius: 12,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontWeight: 900,
                  }}
                >
                  {avatarBusy ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ MODAL: EXACT SAME AS MyPlayers */}
      {isModalOpen && selected ? (
        <div
          onClick={closeModal}
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
              width: 'min(1040px, 100%)',
              borderRadius: 16,
              background: '#fff',
              border: '1px solid #e5e5e5',
              overflow: 'hidden',
              boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
              <div style={{ fontWeight: 950 }}>Card Details</div>
              <button
                onClick={closeModal}
                style={{
                  borderRadius: 10,
                  border: '1px solid #e5e5e5',
                  background: '#fff',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 0 }}>
              {/* Image / card */}
              <div style={{ padding: 18, background: '#111', color: '#fff' }}>
                <div
                  style={{
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
                    border: '1px solid rgba(255,255,255,0.14)',
                    padding: 14,
                    height: 520,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={badgeStyle('#fbbf24')}>{selected.card_type}</div>
                    <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>#{selected.card_id}</div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      marginTop: 12,
                      borderRadius: 16,
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {selectedPlayerImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedPlayerImageUrl} alt={selected.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>Player Image</div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.15 }}>{selected.full_name}</div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{selected.role ?? '—'}</span>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {selectedTeamLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedTeamLogoUrl} alt={String(selectedNationName)} style={{ width: 18, height: 18, borderRadius: 999, objectFit: 'cover', display: 'block' }} />
                        ) : null}
                        <span>{String(selectedNationName)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Player</div>
                    <div style={{ fontSize: 22, fontWeight: 950, marginTop: 2 }}>
                      <Link href={`/players/${selected.player_id}`} style={{ textDecoration: 'none', color: '#111' }}>
                        {selected.full_name}
                      </Link>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
                      Card ID <b>#{selected.card_id}</b> • Minted <b>{new Date(selected.minted_on).toLocaleString()}</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {selected.burned_on ? <span style={badgeStyle('#fecaca')}>Burned</span> : selected.is_active ? <span style={badgeStyle('#bbf7d0')}>Active</span> : <span style={badgeStyle('#fde68a')}>Inactive</span>}
                  </div>
                </div>

                {(() => {
                  const p = pointsDisplayForPlayer(selected.player_id ?? null, 'last');
                  return (
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                      <StatCard label="Last Match Points" value={p.value} title={p.title} />
                      <StatCard label="Points Earned (lifetime)" value={fmtPts(selected.points_earned)} />
                      <StatCard label="Matches Selected" value={selected.matches_selected ?? 0} />
                    </div>
                  );
                })()}

                <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Card metadata</div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 13, color: '#333' }}>
                    <RowKV label="Role" value={selected.role ?? '—'} />
                    <RowKV label="Nation" value={selectedNationName ?? '—'} />
                    <RowKV label="Acquired on" value={new Date(selected.acquired_on).toLocaleString()} />
                    <RowKV label="Number of Owners" value={selected.owners_count ?? '—'} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        button:hover .avatar-hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
