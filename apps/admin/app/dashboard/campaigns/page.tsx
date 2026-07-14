'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/topbar';
import { getSpendBySurvey } from '@/lib/api';
import type { SurveySpend } from '@/lib/api';

function formatCents(cents: number) {
  return `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`;
}

export default function CampaignsPage() {
  const [rows, setRows] = useState<SurveySpend[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpendBySurvey()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Topbar title="Campaigns" />
      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-chart-coral">{error}</p>}

        {rows?.length === 0 && (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted shadow-card">
            No paid-tier campaigns yet. Set a survey's tier to "paid" and give it a budget cap to
            see real-time spend tracking here.
          </div>
        )}

        {rows?.map((row) => {
          const cap = row.budget_cap_cents;
          const pct = cap ? Math.min(100, Math.round((row.spent_cents / cap) * 100)) : 0;
          return (
            <div key={row.survey_id} className="rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">{row.title}</p>
                  <p className="text-xs text-text-muted">
                    {row.verified_responses} verified responses ·{' '}
                    {formatCents(row.incentive_amount_cents)} per completion
                  </p>
                </div>
                <span className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary">
                  {row.status}
                </span>
              </div>

              {cap ? (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary-tint">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-text-muted">
                    {formatCents(row.spent_cents)} spent of {formatCents(cap)} budget ({pct}%)
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">
                  {formatCents(row.spent_cents)} spent · no budget cap set
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
