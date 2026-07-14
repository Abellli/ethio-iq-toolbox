'use client';

import type { AnalyticsFilter } from '@/lib/api';

export function FilterBar({
  filter,
  onChange,
}: {
  filter: AnalyticsFilter;
  onChange: (next: AnalyticsFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3 shadow-card">
      <div>
        <label className="mb-1 block text-xs text-text-muted">Region</label>
        <input
          value={filter.region ?? ''}
          onChange={(e) => onChange({ ...filter, region: e.target.value || undefined })}
          placeholder="Any region"
          className="w-36 rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Gender</label>
        <select
          value={filter.gender ?? ''}
          onChange={(e) => onChange({ ...filter, gender: e.target.value || undefined })}
          className="w-32 rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="">Any</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Age min</label>
        <input
          type="number"
          value={filter.ageMin ?? ''}
          onChange={(e) =>
            onChange({ ...filter, ageMin: e.target.value ? Number(e.target.value) : undefined })
          }
          className="w-20 rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Age max</label>
        <input
          type="number"
          value={filter.ageMax ?? ''}
          onChange={(e) =>
            onChange({ ...filter, ageMax: e.target.value ? Number(e.target.value) : undefined })
          }
          className="w-20 rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">From</label>
        <input
          type="date"
          value={filter.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filter, dateFrom: e.target.value || undefined })}
          className="rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">To</label>
        <input
          type="date"
          value={filter.dateTo ?? ''}
          onChange={(e) => onChange({ ...filter, dateTo: e.target.value || undefined })}
          className="rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>
      {Object.keys(filter).length > 0 && (
        <button
          onClick={() => onChange({})}
          className="rounded-card px-2.5 py-1.5 text-xs text-text-muted hover:text-primary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
