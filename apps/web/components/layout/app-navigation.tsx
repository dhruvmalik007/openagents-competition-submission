'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { ActivitySquare, Bot, DatabaseZap, LayoutDashboard, Map, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/etl', label: 'ETL Pipeline', icon: DatabaseZap },
  { href: '/modules', label: '0G Modules', icon: Bot },
  { href: '/roadmap', label: 'Roadmap', icon: Map },
  { href: '/settings', label: 'Settings', icon: Settings2 }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel h-fit rounded-3xl border-white/10 p-4 lg:sticky lg:top-8">
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <ActivitySquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Aegis Arena</p>
          <p className="text-xs text-muted-foreground">0G control plane</p>
        </div>
      </div>
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors',
                active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
        Structured pages for mission control, exploit ingestion, 0G runtime posture, implementation roadmap, and deployment settings.
      </div>
    </aside>
  );
}
