'use client';

import { ArrowLeftRight } from 'lucide-react';
import type { CrossTabResult } from '@/lib/api';
import type { Question } from '@/lib/types';

const PIVOTABLE_TYPES = ['single_choice', 'multi_choice', 'scale', 'nps'];

export function CrossTabTable({
  questions,
  rowQuestionId,
  columnQuestionId,
  onChangeRow,
  onChangeColumn,
  onSwap,
  result,
}: {
  questions: Question[];
  rowQuestionId: string;
  columnQuestionId: string;
  onChangeRow: (id: string) => void;
  onChangeColumn: (id: string) => void;
  onSwap: () => void;
  result: CrossTabResult | null;
}) {
  const options = questions.filter((q) => PIVOTABLE_TYPES.includes(q.type));

  if (options.length < 2) {
    return (
      <p className="text-sm text-text-muted">
        Add at least two choice/scale/NPS questions to this survey to build a cross-tab.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <select
          value={rowQuestionId}
          onChange={(e) => onChangeRow(e.target.value)}
          className="max-w-xs truncate rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        >
          {options.map((q) => (
            <option key={q.id} value={q.id}>
              {q.prompt || 'Untitled question'}
            </option>
          ))}
        </select>
        <button
          onClick={onSwap}
          className="rounded-card border border-border p-1.5 text-text-muted hover:bg-primary-tint/40"
          title="Swap axes"
        >
          <ArrowLeftRight size={14} />
        </button>
        <select
          value={columnQuestionId}
          onChange={(e) => onChangeColumn(e.target.value)}
          className="max-w-xs truncate rounded-card border border-border px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        >
          {options.map((q) => (
            <option key={q.id} value={q.id}>
              {q.prompt || 'Untitled question'}
            </option>
          ))}
        </select>
      </div>

      {!result || result.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">No data for this combination yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  &nbsp;
                </th>
                {result.columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row}>
                  <td className="border-b border-border px-3 py-2 font-medium text-text">{row}</td>
                  {result.columns.map((col) => (
                    <td key={col} className="border-b border-border px-3 py-2 text-text-muted">
                      {result.cells[row]?.[col] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
