'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/topbar';
import { createSurvey } from '@/lib/api';

export default function NewSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const survey = await createSurvey({ title, description });
      router.push(`/dashboard/surveys/${survey.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar title="New survey" />
      <div className="p-6">
        <form
          onSubmit={handleSubmit}
          className="max-w-lg rounded-card border border-border bg-surface p-6 shadow-card"
        >
          <label className="mb-1 block text-sm text-text-muted">Survey title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Consumer Sentiment Tracker — Q3 2026"
            className="mb-4 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <label className="mb-1 block text-sm text-text-muted">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mb-6 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />

          {error && <p className="mb-4 text-sm text-chart-coral">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create & open builder'}
          </button>
        </form>
      </div>
    </>
  );
}
