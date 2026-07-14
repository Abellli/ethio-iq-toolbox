export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <p className="chart-title">{label}</p>
      <p className="kpi-number mt-1">{value}</p>
    </div>
  );
}
