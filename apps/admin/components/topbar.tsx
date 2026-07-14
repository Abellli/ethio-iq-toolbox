'use client';

import { Download, ChevronDown } from 'lucide-react';

export function Topbar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span className="text-text font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 rounded-card border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-primary-tint/60">
          Last 30 days
          <ChevronDown size={14} />
        </button>
        <button className="flex items-center gap-1.5 rounded-card bg-primary px-3 py-1.5 text-sm text-white hover:opacity-90">
          <Download size={14} />
          Export
        </button>
        <button className="flex items-center gap-1.5 rounded-card border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-primary-tint/60">
          Acme Corp
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
