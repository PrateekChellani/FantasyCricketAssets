import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

export const dynamic = 'force-dynamic'; // avoid prerender errors

export default function CallbackPage() {
  return (
    <main>
      <Suspense fallback={<p>Finishing sign-in…</p>}>
        <CallbackClient />
      </Suspense>
    </main>
  );
}
