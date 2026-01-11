import './globals.css';
import type { Metadata } from 'next';
import NavBar from './components/NavBar';

export const metadata: Metadata = {
  title: 'Fantasy Cricket',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#fff', color: '#111' }}>
        <NavBar />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
