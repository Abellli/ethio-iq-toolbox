'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  BarChart3,
  ClipboardList,
  Megaphone,
  Users,
  Receipt,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard/surveys', label: 'Surveys', icon: ClipboardList },
  { href: '/dashboard', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/respondents', label: 'Respondents', icon: Users },
  { href: '/dashboard/billing', label: 'Billing', icon: Receipt },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5">
        <span className="font-semibold text-text tracking-tight">Ethio IQ Toolbox</span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-card px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary-tint text-primary font-medium'
                  : 'text-text-muted hover:bg-primary-tint/60',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
