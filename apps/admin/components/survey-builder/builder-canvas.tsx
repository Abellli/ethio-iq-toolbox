'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Question } from '@/lib/types';
import { SortableQuestionItem } from './sortable-question-item';

export function BuilderCanvas({
  questions,
  selectedKey,
  onReorder,
  onSelect,
  onRemove,
}: {
  questions: Question[];
  selectedKey: string | null;
  onReorder: (next: Question[]) => void;
  onSelect: (clientKey: string) => void;
  onRemove: (clientKey: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.clientKey === active.id);
    const newIndex = questions.findIndex((q) => q.clientKey === over.id);
    onReorder(arrayMove(questions, oldIndex, newIndex));
  }

  return (
    <div className="flex-1 p-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
        Question flow ({questions.length})
      </p>
      {questions.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-card border border-dashed border-border text-sm text-text-muted">
          Add a question from the left panel to get started.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={questions.map((q) => q.clientKey)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {questions.map((q, index) => (
                <SortableQuestionItem
                  key={q.clientKey}
                  question={q}
                  index={index}
                  active={q.clientKey === selectedKey}
                  onSelect={() => onSelect(q.clientKey)}
                  onRemove={() => onRemove(q.clientKey)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
