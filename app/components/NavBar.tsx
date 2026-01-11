'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AuthStatus from './AuthStatus';
import CPBalance from './CPBalance';
import DailyLoginButton from './DailyLoginButton';
import { supabase } from '../lib/supabaseClient';

type OnboardingStateRow = {
  onboarding_completed_at: string | null;
};

type NotificationRow = {
  notification_id: number;
  user_id: string;
  header_text: string;
  body_text: string | null;
  created_at: string;
  status: string; // 'UNREAD' | 'READ' (enum in DB)
  read_at: string | null;
  deeplink: string | null;
};

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
        stroke="#111827"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="#111827"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatWhen(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function NotificationBell() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // load + mark read ONLY when opening
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setBusy(true);
      setErr(null);

      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw new Error(userErr.message);

        const meId = userData.user?.id;
        if (!meId) {
          // Not signed in -> show empty dropdown, but do not error
          if (!cancelled) setRows([]);
          return;
        }

        // Fetch latest 5
        const { data, error } = await supabase
          .from('v_notifications')
          .select('notification_id,user_id,header_text,body_text,created_at,status,read_at,deeplink')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw new Error(error.message);

        const listAll = ((data as any) ?? []) as NotificationRow[];

        // Client-side filter (you said view doesn't filter)
        const list = listAll.filter((r) => r.user_id === meId);

        if (!cancelled) setRows(list);

        // Mark the shown ones as read (only UNREAD)
        const ids = list
          .filter((n) => String(n.status || '').toUpperCase() === 'UNREAD')
          .map((n) => n.notification_id)
          .filter((x) => Number.isFinite(x));

        if (ids.length) {
          const { error: markErr } = await supabase.rpc('mark_notifications_read', {
            p_notification_ids: ids,
          } as any);

          if (markErr) {
            // non-fatal; dropdown should still work
            console.warn('[NotificationBell] mark read failed:', markErr.message);
          } else {
            // optimistic update
            if (!cancelled) {
              setRows((prev) =>
                prev.map((n) =>
                  ids.includes(n.notification_id)
                    ? { ...n, status: 'READ', read_at: n.read_at ?? new Date().toISOString() }
                    : n
                )
              );
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load notifications');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const hasUnread = rows.some((n) => String(n.status || '').toUpperCase() === 'UNREAD');
  const unreadCount = rows.filter((n) => String(n.status || '').toUpperCase() === 'UNREAD').length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          background: hasUnread ? '#fff7ed' : '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <BellIcon />

        {unreadCount > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 6px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 900,
              lineHeight: '18px',
              textAlign: 'center',
              border: '2px solid #fff',
              boxSizing: 'border-box',
            }}
            aria-label={`${unreadCount} unread notifications`}
            title={`${unreadCount} unread`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        ) : null}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 44,
            width: 380,
            maxWidth: 'calc(100vw - 24px)',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 950, fontSize: 14 }}>Notifications</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {busy ? 'Loading…' : 'Latest 5 (opening marks them as read)'}
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {err ? (
              <div style={{ padding: 14, color: '#991b1b', fontSize: 13, background: '#fee2e2' }}>
                {err}
              </div>
            ) : !busy && rows.length === 0 ? (
              <div style={{ padding: 14, color: '#6b7280', fontSize: 13 }}>
                No notifications yet.
              </div>
            ) : (
              rows.map((n) => {
                const isUnread = String(n.status || '').toUpperCase() === 'UNREAD';
                const href = n.deeplink || '/profile/notifications';

                return (
                  <Link
                    key={n.notification_id}
                    href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'block',
                      padding: '12px 14px',
                      borderBottom: '1px solid #f3f4f6',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: isUnread ? '#fff7ed' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 1.2 }}>
                      {n.header_text}
                    </div>
                    {n.body_text ? (
                      <div style={{ color: '#374151', fontSize: 12, marginTop: 4, lineHeight: 1.25 }}>
                        {n.body_text}
                      </div>
                    ) : null}
                    <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 6 }}>
                      {formatWhen(n.created_at)}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #f3f4f6' }}>
            <Link
              href="/profile/notifications"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                fontWeight: 900,
                color: '#111827',
                background: '#fff',
              }}
            >
              View All
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const isActive = (base: string) => pathname === base || pathname.startsWith(base + '/');

  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);

  // ✅ VERY lightweight onboarding check
  useEffect(() => {
    (async () => {
      try {
        // Do nothing while on onboarding itself
        if (pathname.startsWith('/onboarding')) {
          setShowOnboardingBanner(false);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          setShowOnboardingBanner(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_onboarding_state') // public view
          .select('onboarding_completed_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.warn('onboarding check failed:', error.message);
          setShowOnboardingBanner(false);
          return;
        }

        const row = data as OnboardingStateRow | null;
        setShowOnboardingBanner(!row?.onboarding_completed_at);
      } catch {
        setShowOnboardingBanner(false);
      }
    })();
  }, [pathname]);

  return (
    <>
      {/* ================= HEADER ================= */}
      <header style={{ borderBottom: '1px solid #e5e5e5', background: '#fff' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 15,
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit',
              marginLeft: '-55px',
            }}
          >
            <img src="/logo.png" alt="Logo" width={36} height={36} />
            <strong style={{ fontSize: 16 }}>Fantasy Cricket</strong>
          </Link>

          {/* Nav */}
          <nav>
            <ul className="nav-root">
              <li className="nav-item">
                <Link href="/play" className={isActive('/play') ? 'active' : ''}>Play</Link>
                <ul className="dropdown">
                  <li><Link href="/play">Upcoming</Link></li>
                  <li><Link href="/play/live">Live</Link></li>
                  <li><Link href="/play/competitions">Competitions</Link></li>
                  <li><Link href="/play/leaderboard">Leaderboard</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/play/MyPlayers" className={isActive('/play/MyPlayers') ? 'active' : ''}>Roster</Link>
                <ul className="dropdown">
                  <li><Link href="/play/MyPlayers">My Players</Link></li>
                  <li><Link href="/play/MyPacks">My Packs</Link></li>
                  <li><Link href="/play/MyPlayers/scrapbook">Scrapbook</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/players" className={pathname.startsWith('/players') ? 'active' : ''}>Players</Link>
                <ul className="dropdown">
                  <li><Link href="/players">Player Scorecard</Link></li>
                  <li><Link href="/players/leaderboard">Player Leaderboard</Link></li>
                  <li><Link href="/players/scout">Scout</Link></li>
                  <li><Link href="/players/tiers">Tiers</Link></li>
                  <li><Link href="/players/all_cards">All Cards</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/matches" className={pathname.startsWith('/matches') ? 'active' : ''}>Matches</Link>
                <ul className="dropdown">
                  <li><Link href="/matches">Match Results</Link></li>
                  <li><Link href="/matches/points">Match Points Breakdown</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/guide/how-to-play" className={isActive('/guide') ? 'active' : ''}>Guide</Link>
                <ul className="dropdown">
                  <li><Link href="/guide/how-to-play">How to Play</Link></li>
                  <li><Link href="/guide/scoring-matrix">Scoring Matrix</Link></li>
                  <li><Link href="/guide/faq">FAQ</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/about" className={pathname.startsWith('/about') ? 'active' : ''}>About</Link>
                <ul className="dropdown">
                  <li><Link href="/about">About</Link></li>
                  <li><Link href="/about/contact">Contact Us</Link></li>
                </ul>
              </li>

              <li className="nav-item">
                <Link href="/store" className={isActive('/store') ? 'active' : ''}>Store</Link>
                <ul className="dropdown">
                  <li><Link href="/store">Buy Packs</Link></li>
                </ul>
              </li>
            </ul>
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DailyLoginButton />
            <CPBalance />
            <NotificationBell />
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* ================= ONBOARDING BANNER ================= */}
      {showOnboardingBanner && (
        <div style={{ borderBottom: '1px solid #e5e5e5', background: '#fff7ed' }}>
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>Onboarding Incomplete</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                Complete onboarding to unlock your free starter pack.
              </div>
            </div>

            <Link
              href="/onboarding"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #fb923c',
                background: '#fb923c',
                color: '#111827',
                textDecoration: 'none',
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              Complete Onboarding
            </Link>
          </div>
        </div>
      )}

      {/* ================= SCROLL BANNER ================= */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e5e5',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <div
          style={{
            whiteSpace: 'nowrap',
            display: 'inline-block',
            padding: '8px 0',
            animation: 'scroll-banner 22s linear infinite',
          }}
        >
          This app is in Pre-User Testing. Thank you for helping test it.
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-banner {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </>
  );
}
