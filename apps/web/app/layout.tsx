import type { Metadata } from 'next';
import './globals.css';
import { AppNavigation } from '../components/layout/app-navigation';

export const metadata: Metadata = {
  title: 'Aegis Arena Control Plane',
  description: 'Vercel-native telemetry, ETL, and per-user vector memory dashboard for 0G-backed red teaming.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="dashboard-shell grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <AppNavigation />
          <main className="min-w-0 space-y-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
