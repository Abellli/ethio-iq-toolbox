'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { listSurveys } from '@/lib/api';
import type { Survey } from '@/lib/types';

const STATUS_STYLES: Record<Survey['status'], string> = {
  draft: 'bg-border/60 text-text-muted',
  active: 'bg-primary-tint text-primary',
  paused: 'bg-chart-amber/15 text-chart-amber',
  closed: 'bg-text-muted/15 text-text-muted',
};

export default function SurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSurveys()
      .then(setSurveys)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Topbar title="Surveys" />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {surveys ? `${surveys.length} survey${surveys.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
          <Link
            href="/dashboard/surveys/new"
            className="flex items-center gap-1.5 rounded-card bg-primary px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            <Plus size={14} />
            New survey
          </Link>
        </div>

        {error && (
          <div className="rounded-card border border-border bg-surface p-4 text-sm text-chart-coral">
            {error}
          </div>
        )}

        <div className="rounded-card border border-border bg-surface shadow-card">
          {surveys?.length === 0 && (
            <div className="p-8 text-center text-sm text-text-muted">
              No surveys yet. Create your first one to start collecting responses.
            </div>
          )}
          {surveys?.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/surveys/${s.id}`}
              className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-primary-tint/40"
            >
              <div>
                <p className="text-sm font-medium text-text">{s.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {s.tier === 'paid' ? 'Paid' : 'Free'} · {s.response_count ?? 0} responses
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                {s.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
