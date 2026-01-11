import { Suspense } from 'react';
import SignInClient from './SignInClient';

export const dynamic = 'force-dynamic'; // avoid prerendering

export default function SignInPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <SignInClient />
      </Suspense>
    </main>
  );
}
