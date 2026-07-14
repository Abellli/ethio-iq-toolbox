'use client';

import type { Question } from '@/lib/types';

export function SurveyPreview({ title, questions }: { title: string; questions: Question[] }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
      <h2 className="text-base font-medium text-text">{title || 'Untitled survey'}</h2>
      {questions.map((q, i) => (
        <div key={q.clientKey} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
          <p className="mb-2 text-sm text-text">
            {i + 1}. {q.prompt || 'Untitled question'}
            {q.isRequired !== false && <span className="text-chart-coral"> *</span>}
          </p>
          {renderInput(q)}
        </div>
      ))}
      {questions.length === 0 && (
        <p className="text-sm text-text-muted">Nothing to preview yet — add a question.</p>
      )}
    </div>
  );
}

function renderInput(q: Question) {
  switch (q.type) {
    case 'single_choice':
    case 'multi_choice': {
      const options = (q.config?.options as string[] | undefined) ?? ['Option 1', 'Option 2'];
      return (
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-text-muted">
              <input type={q.type === 'single_choice' ? 'radio' : 'checkbox'} disabled />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case 'scale': {
      const min = (q.config?.min as number) ?? 1;
      const max = (q.config?.max as number) ?? 5;
      return (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{min}</span>
          <input type="range" min={min} max={max} disabled className="flex-1" />
          <span>{max}</span>
        </div>
      );
    }
    case 'nps':
      return (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <span
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-card border border-border text-xs text-text-muted"
            >
              {i}
            </span>
          ))}
        </div>
      );
    case 'open_text':
      return (
        <textarea
          disabled
          placeholder="Respondent's answer…"
          rows={2}
          className="w-full rounded-card border border-border px-3 py-2 text-sm text-text-muted"
        />
      );
    case 'location':
      return <p className="text-xs text-text-muted">📍 Location will be captured with permission</p>;
    default:
      return null;
  }
}
