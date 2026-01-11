import { Suspense } from 'react';
import SignUpClient from './SignUpClient';

export const dynamic = 'force-dynamic'; // avoids prerender hiccups for client hooks

export default function Page() {
  const pageWrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '18px 16px' };

  const card: React.CSSProperties = {
    borderRadius: 16,
    background: '#fff',
    border: '1px solid #e5e5e5',
    boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
    overflow: 'hidden',
  };

  return (
    <main style={pageWrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Create your account</h1>
      </div>

      <div style={{ marginTop: 12, color: '#666', fontWeight: 800, fontSize: 13 }}>
        Use email + password or continue with Google.
      </div>

      <div style={{ marginTop: 14, ...card }}>
        <div style={{ padding: 16, borderBottom: '1px solid #eee', background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 900 }}>GET STARTED</div>
          <div style={{ fontSize: 22, fontWeight: 950, marginTop: 4 }}>Join Fantasy Cricket</div>
          <div style={{ marginTop: 6, color: '#444' }}>Create your account, then you’ll be taken to onboarding.</div>
        </div>

        <div style={{ padding: 16 }}>
          <Suspense fallback={<p style={{ margin: 0, color: '#666', fontWeight: 800 }}>Loading…</p>}>
            <SignUpClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
