'use client';

import type { Question } from '@/lib/types';
import { QUESTION_TYPE_LABELS } from '@/lib/types';

export function SettingsDrawer({
  question,
  onChange,
}: {
  question: Question | null;
  onChange: (patch: Partial<Question>) => void;
}) {
  if (!question) {
    return (
      <div className="w-72 shrink-0 border-l border-border bg-surface p-4">
        <p className="text-sm text-text-muted">Select a question to edit its settings.</p>
      </div>
    );
  }

  const options = (question.config?.options as string[] | undefined) ?? ['Option 1', 'Option 2'];

  function updateOptions(next: string[]) {
    onChange({ config: { ...question.config, options: next } });
  }

  return (
    <div className="w-72 shrink-0 space-y-4 border-l border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {QUESTION_TYPE_LABELS[question.type]} settings
      </p>

      <div>
        <label className="mb-1 block text-sm text-text-muted">Prompt</label>
        <textarea
          value={question.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={2}
          className="w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {(question.type === 'single_choice' || question.type === 'multi_choice') && (
        <div>
          <label className="mb-1 block text-sm text-text-muted">Options</label>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  updateOptions(next);
                }}
                className="w-full rounded-card border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            ))}
          </div>
          <button
            onClick={() => updateOptions([...options, `Option ${options.length + 1}`])}
            className="mt-2 text-xs text-primary hover:underline"
          >
            + Add option
          </button>
        </div>
      )}

      {question.type === 'scale' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Min</label>
            <input
              type="number"
              value={(question.config?.min as number) ?? 1}
              onChange={(e) => onChange({ config: { ...question.config, min: Number(e.target.value) } })}
              className="w-full rounded-card border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Max</label>
            <input
              type="number"
              value={(question.config?.max as number) ?? 5}
              onChange={(e) => onChange({ config: { ...question.config, max: Number(e.target.value) } })}
              className="w-full rounded-card border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {question.type === 'open_text' && (
        <p className="text-xs text-text-muted">
          Responses to this question are automatically scored for sentiment by the analytics
          microservice (Amharic + English).
        </p>
      )}

      {question.type === 'location' && (
        <p className="text-xs text-text-muted">
          Captures GPS with permission at submission and is checked against the survey's geofence,
          if one is set.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={question.isRequired !== false}
          onChange={(e) => onChange({ isRequired: e.target.checked })}
        />
        Required
      </label>
    </div>
  );
}
