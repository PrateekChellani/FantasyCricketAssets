import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  return (
    <main style={{ padding: 24 }}>
      <Suspense fallback={<p>Loading onboarding…</p>}>
        <OnboardingClient />
      </Suspense>
    </main>
  );
}
