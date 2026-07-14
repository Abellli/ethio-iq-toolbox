'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Question } from '@/lib/types';
import { QUESTION_TYPE_LABELS } from '@/lib/types';

export function SortableQuestionItem({
  question,
  index,
  active,
  onSelect,
  onRemove,
}: {
  question: Question;
  index: number;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.clientKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={clsx(
        'flex items-center gap-3 rounded-card border bg-surface px-3 py-3 cursor-pointer',
        active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
        isDragging && 'opacity-60',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab text-text-muted"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-text">{question.prompt || 'Untitled question'}</p>
        <p className="text-xs text-text-muted">
          {index + 1}. {QUESTION_TYPE_LABELS[question.type]}
          {question.isRequired === false ? ' · optional' : ''}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-text-muted hover:text-chart-coral"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
