'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { listSurveys } from '@/lib/api';
import type { Survey } from '@/lib/types';

export default function AnalyticsLandingPage() {
  const [surveys, setSurveys] = useState<Survey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSurveys()
      .then(setSurveys)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Topbar title="Analytics" />
      <div className="p-6">
        <p className="mb-4 text-sm text-text-muted">Choose a survey to see its full analytics view.</p>
        {error && <p className="text-sm text-chart-coral">{error}</p>}

        {surveys?.length === 0 && (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted shadow-card">
            No surveys yet —{' '}
            <Link href="/dashboard/surveys/new" className="text-primary hover:underline">
              create one first
            </Link>
            .
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {surveys?.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/analytics/${s.id}`}
              className="rounded-card border border-border bg-surface p-5 shadow-card hover:border-primary"
            >
              <BarChart3 size={18} className="mb-3 text-primary" />
              <p className="text-sm font-medium text-text">{s.title}</p>
              <p className="mt-1 text-xs text-text-muted">
                {s.response_count ?? 0} responses · {s.status}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
