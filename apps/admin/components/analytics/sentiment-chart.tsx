'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SentimentBreakdown } from '@/lib/api';

const COLORS: Record<string, string> = {
  Positive: '#14B8A6', // chart.teal
  Neutral: '#F59E0B',  // chart.amber
  Negative: '#FB7185', // chart.coral
};

export function SentimentChart({ data }: { data: SentimentBreakdown }) {
  const chartData = [
    { label: 'Positive', value: data.positive },
    { label: 'Neutral', value: data.neutral },
    { label: 'Negative', value: data.negative },
  ];

  const total = data.positive + data.neutral + data.negative;
  if (total === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-text-muted">
        No open-text responses scored yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.label} fill={COLORS[entry.label]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
