'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { Topbar } from '@/components/topbar';
import { QuestionPalette } from '@/components/survey-builder/question-palette';
import { BuilderCanvas } from '@/components/survey-builder/builder-canvas';
import { SettingsDrawer } from '@/components/survey-builder/settings-drawer';
import { SurveyPreview } from '@/components/survey-builder/survey-preview';
import { getSurvey, saveQuestions, publishSurvey, pauseSurvey } from '@/lib/api';
import type { Question, QuestionType, Survey } from '@/lib/types';

function newQuestion(type: QuestionType): Question {
  const defaults: Record<QuestionType, Partial<Question>> = {
    single_choice: { config: { options: ['Option 1', 'Option 2'] } },
    multi_choice: { config: { options: ['Option 1', 'Option 2'] } },
    scale: { config: { min: 1, max: 5 } },
    nps: {},
    open_text: {},
    location: {},
  };
  return {
    clientKey: crypto.randomUUID(),
    type,
    prompt: '',
    isRequired: true,
    ...defaults[type],
  };
}

export default function SurveyBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSurvey(id)
      .then((s) => {
        setSurvey(s);
        setQuestions(
          (s.questions ?? []).map((q) => ({ ...q, clientKey: q.id ?? crypto.randomUUID() })),
        );
      })
      .catch((e) => setError(e.message));
  }, [id]);

  function addQuestion(type: QuestionType) {
    const q = newQuestion(type);
    setQuestions((prev) => [...prev, q]);
    setSelectedKey(q.clientKey);
  }

  function updateSelected(patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q) => (q.clientKey === selectedKey ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(clientKey: string) {
    setQuestions((prev) => prev.filter((q) => q.clientKey !== clientKey));
    if (selectedKey === clientKey) setSelectedKey(null);
  }

  async function handleSaveDraft() {
    setSaveState('saving');
    try {
      const saved = await saveQuestions(id, questions);
      setQuestions(saved.map((q: any) => ({ ...q, clientKey: q.id })));
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (e: any) {
      setError(e.message);
      setSaveState('error');
    }
  }

  async function handlePublish() {
    await handleSaveDraft();
    try {
      const updated = await publishSurvey(id);
      setSurvey(updated);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handlePause() {
    const updated = await pauseSurvey(id);
    setSurvey(updated);
  }

  const selected = questions.find((q) => q.clientKey === selectedKey) ?? null;

  return (
    <>
      <Topbar title={survey?.title ?? 'Loading…'} />

      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex rounded-card border border-border p-0.5">
          <button
            onClick={() => setMode('edit')}
            className={clsx(
              'flex items-center gap-1.5 rounded-[8px] px-3 py-1 text-sm',
              mode === 'edit' ? 'bg-primary-tint text-primary' : 'text-text-muted',
            )}
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={clsx(
              'flex items-center gap-1.5 rounded-[8px] px-3 py-1 text-sm',
              mode === 'preview' ? 'bg-primary-tint text-primary' : 'text-text-muted',
            )}
          >
            <Eye size={14} /> Preview
          </button>
        </div>

        <div className="flex items-center gap-3">
          {saveState === 'saved' && <span className="text-xs text-text-muted">Saved</span>}
          <button
            onClick={handleSaveDraft}
            disabled={saveState === 'saving'}
            className="rounded-card border border-border px-3 py-1.5 text-sm text-text hover:bg-primary-tint/40"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save as draft'}
          </button>
          {survey?.status === 'active' ? (
            <button
              onClick={handlePause}
              className="rounded-card bg-chart-amber px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="rounded-card bg-primary px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-6 pt-3 text-sm text-chart-coral">{error}</p>}

      {mode === 'edit' ? (
        <div className="flex">
          <QuestionPalette onAdd={addQuestion} />
          <BuilderCanvas
            questions={questions}
            selectedKey={selectedKey}
            onReorder={setQuestions}
            onSelect={setSelectedKey}
            onRemove={removeQuestion}
          />
          <SettingsDrawer question={selected} onChange={updateSelected} />
        </div>
      ) : (
        <div className="p-6">
          <SurveyPreview title={survey?.title ?? ''} questions={questions} />
        </div>
      )}
    </>
  );
}
