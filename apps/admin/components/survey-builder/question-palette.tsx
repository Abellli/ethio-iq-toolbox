'use client';

import {
  CircleDot,
  ListChecks,
  SlidersHorizontal,
  Gauge,
  AlignLeft,
  MapPin,
} from 'lucide-react';
import type { QuestionType } from '@/lib/types';
import { QUESTION_TYPE_LABELS } from '@/lib/types';

const BLOCKS: { type: QuestionType; icon: typeof CircleDot }[] = [
  { type: 'single_choice', icon: CircleDot },
  { type: 'multi_choice', icon: ListChecks },
  { type: 'scale', icon: SlidersHorizontal },
  { type: 'nps', icon: Gauge },
  { type: 'open_text', icon: AlignLeft },
  { type: 'location', icon: MapPin },
];

export function QuestionPalette({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  return (
    <div className="w-56 shrink-0 border-r border-border bg-surface p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
        Question types
      </p>
      <div className="space-y-1.5">
        {BLOCKS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex w-full items-center gap-2.5 rounded-card border border-border px-3 py-2 text-left text-sm text-text hover:border-primary hover:bg-primary-tint/40"
          >
            <Icon size={16} className="text-text-muted" />
            {QUESTION_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-muted">
        Click a block to add it to the canvas, then drag to reorder.
      </p>
    </div>
  );
}
