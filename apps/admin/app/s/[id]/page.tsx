'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicSurvey, submitPublicResponse } from '@/lib/api';

interface PublicQuestion {
  id: string;
  type: string;
  prompt: string;
  config: Record<string, any> | null;
  is_required: boolean;
}

interface PublicSurvey {
  id: string;
  title: string;
  description: string | null;
  questions: PublicQuestion[];
}

function getDeviceFingerprint(): string {
  const key = 'eiq_device_fingerprint';
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

export default function PublicSurveyPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    getPublicSurvey(id)
      .then(setSurvey)
      .catch((e) => setError(e.message));
  }, [id]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    if (!survey) return;
    const missing = survey.questions.filter((q) => q.is_required && !answers[q.id]);
    if (missing.length) {
      setError('Please answer all required questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const hasLocationQuestion = survey.questions.some((q) => q.type === 'location');
    let gps: { gpsLat?: number; gpsLng?: number; gpsAccuracyMeters?: number } = {};

    if (hasLocationQuestion && navigator.geolocation) {
      gps = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              gpsLat: pos.coords.latitude,
              gpsLng: pos.coords.longitude,
              gpsAccuracyMeters: pos.coords.accuracy,
            }),
          () => resolve({}),
          { timeout: 5000 },
        );
      });
    }

    try {
      await submitPublicResponse(survey.id, {
        deviceFingerprintHash: getDeviceFingerprint(),
        ...gps,
        completionSeconds: Math.round((Date.now() - startedAt) / 1000),
        answers: Object.entries(answers).map(([questionId, answerValue]) => ({
          questionId,
          answerValue,
        })),
      });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-chart-coral">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-card border border-border bg-surface p-6 text-center shadow-card">
          <p className="text-base font-medium text-text">Thanks for your response!</p>
          <p className="mt-1 text-sm text-text-muted">
            Your submission has been received and is being reviewed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-tint px-4 py-8">
      <div className="mx-auto max-w-md space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <div>
          <h1 className="text-base font-medium text-text">{survey?.title ?? 'Loading…'}</h1>
          {survey?.description && <p className="mt-1 text-sm text-text-muted">{survey.description}</p>}
        </div>

        {survey?.questions.map((q, i) => (
          <div key={q.id} className="border-t border-border pt-4">
            <p className="mb-2 text-sm text-text">
              {i + 1}. {q.prompt}
              {q.is_required && <span className="text-chart-coral"> *</span>}
            </p>
            <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          </div>
        ))}

        {error && <p className="text-sm text-chart-coral">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !survey}
          className="w-full rounded-card bg-primary py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit response'}
        </button>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: PublicQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (question.type) {
    case 'single_choice': {
      const options = (question.config?.options as string[]) ?? [];
      return (
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-text">
              <input
                type="radio"
                name={question.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case 'multi_choice': {
      const options = (question.config?.options as string[]) ?? [];
      const selected = (value as string[]) ?? [];
      return (
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt),
                  )
                }
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case 'scale': {
      const min = (question.config?.min as number) ?? 1;
      const max = (question.config?.max as number) ?? 5;
      return (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{min}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={(value as number) ?? min}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1"
          />
          <span>{max}</span>
          <span className="w-6 text-right text-text">{(value as number) ?? min}</span>
        </div>
      );
    }
    case 'nps':
      return (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => onChange(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-card border text-xs ${
                value === i ? 'border-primary bg-primary-tint text-primary' : 'border-border text-text-muted'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      );
    case 'open_text':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      );
    case 'location':
      return (
        <p className="text-xs text-text-muted">
          📍 We'll ask for your location when you submit, to verify you're in the target area.
        </p>
      );
    default:
      return null;
  }
}
