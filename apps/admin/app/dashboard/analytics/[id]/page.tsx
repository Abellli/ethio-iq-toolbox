'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { KpiCard } from '@/components/kpi-card';
import { FilterBar } from '@/components/analytics/filter-bar';
import { SentimentChart } from '@/components/analytics/sentiment-chart';
import { TrendChart } from '@/components/analytics/trend-chart';
import { CrossTabTable } from '@/components/analytics/crosstab-table';
import { Sunburst } from '@/components/analytics/sunburst';

// deck.gl touches WebGL/window at module load — must not run during SSR.
const ResponseHeatmap = dynamic(
  () => import('@/components/analytics/response-heatmap').then((m) => m.ResponseHeatmap),
  { ssr: false, loading: () => <div className="h-72 rounded-card bg-primary-tint" /> },
);
import {
  getSurvey,
  getKpis,
  getSentimentBreakdown,
  getTrend,
  getCrossTab,
  getHeatmapPoints,
  getSunburstData,
  downloadCsvExport,
} from '@/lib/api';
import type {
  AnalyticsFilter,
  Kpis,
  SentimentBreakdown,
  TrendPoint,
  CrossTabResult,
  HeatmapPoint,
  SunburstNode,
} from '@/lib/api';
import type { Survey } from '@/lib/types';

export default function SurveyAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [filter, setFilter] = useState<AnalyticsFilter>({});
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [sentiment, setSentiment] = useState<SentimentBreakdown | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [crossTab, setCrossTab] = useState<CrossTabResult | null>(null);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[] | null>(null);
  const [sunburstData, setSunburstData] = useState<SunburstNode | null>(null);
  const [rowQuestionId, setRowQuestionId] = useState('');
  const [columnQuestionId, setColumnQuestionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getSurvey(id)
      .then((s) => {
        setSurvey(s);
        const pivotable = (s.questions ?? []).filter((q) =>
          ['single_choice', 'multi_choice', 'scale', 'nps'].includes(q.type),
        );
        if (pivotable.length >= 2) {
          setRowQuestionId(pivotable[0].id!);
          setColumnQuestionId(pivotable[1].id!);
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    getKpis(id, filter).then(setKpis).catch((e) => setError(e.message));
    getSentimentBreakdown(id, filter).then(setSentiment).catch((e) => setError(e.message));
    getTrend(id, filter).then(setTrend).catch((e) => setError(e.message));
    getHeatmapPoints(id, filter).then(setHeatmapPoints).catch((e) => setError(e.message));
    getSunburstData(id, filter).then(setSunburstData).catch((e) => setError(e.message));
  }, [id, filter]);

  useEffect(() => {
    if (!rowQuestionId || !columnQuestionId) return;
    getCrossTab(id, rowQuestionId, columnQuestionId, filter)
      .then(setCrossTab)
      .catch((e) => setError(e.message));
  }, [id, rowQuestionId, columnQuestionId, filter]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsvExport(id, filter);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Topbar title={survey?.title ?? 'Loading…'} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <FilterBar filter={filter} onChange={setFilter} />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex shrink-0 items-center gap-1.5 rounded-card bg-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {error && <p className="text-sm text-chart-coral">{error}</p>}

        {/* KPI strip — always visible without scrolling (4.3) */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Responses" value={kpis ? String(kpis.totalResponses) : '…'} />
          <KpiCard label="Completion Rate" value={kpis ? `${kpis.completionRate}%` : '…'} />
          <KpiCard label="Fraud-Flagged %" value={kpis ? `${kpis.fraudFlaggedPct}%` : '…'} />
          <KpiCard
            label="Avg. Sentiment"
            value={kpis?.avgSentiment !== null && kpis ? kpis.avgSentiment.toFixed(2) : '—'}
          />
        </div>

        {/* Primary visualization row: heatmap (left, larger) + sentiment breakdown (right) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="chart-title">Regional response density</p>
            <div className="mt-3">
              {heatmapPoints ? <ResponseHeatmap points={heatmapPoints} /> : null}
            </div>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="chart-title">Sentiment breakdown</p>
            <div className="mt-3">{sentiment ? <SentimentChart data={sentiment} /> : null}</div>
          </div>
        </div>

        {/* Cross-tabulation table */}
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="chart-title mb-3">Cross-tabulation</p>
          <CrossTabTable
            questions={survey?.questions ?? []}
            rowQuestionId={rowQuestionId}
            columnQuestionId={columnQuestionId}
            onChangeRow={setRowQuestionId}
            onChangeColumn={setColumnQuestionId}
            onSwap={() => {
              const r = rowQuestionId;
              setRowQuestionId(columnQuestionId);
              setColumnQuestionId(r);
            }}
            result={crossTab}
          />
        </div>

        {/* Secondary row: trend line + sunburst placeholder */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="chart-title">Responses over time</p>
            <div className="mt-3">{trend ? <TrendChart data={trend} /> : null}</div>
          </div>
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="chart-title">Region → sub-region → sentiment</p>
            <div className="mt-3 flex justify-center">
              {sunburstData ? <Sunburst data={sunburstData} /> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
