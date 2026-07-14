'use client';

import { useMemo } from 'react';
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy';
import { arc as d3arc } from 'd3-shape';
import type { SunburstNode } from '@/lib/api';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#14B8A6',
  neutral: '#F59E0B',
  negative: '#FB7185',
  unscored: '#94A3B8',
};
const REGION_PALETTE = ['#2196F3', '#8B5CF6', '#14B8A6', '#F59E0B', '#FB7185', '#0EA5E9'];

const SIZE = 280;

export function Sunburst({ data }: { data: SunburstNode }) {
  const nodes = useMemo(() => {
    const radius = SIZE / 2;
    const root = hierarchy(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laidOut = partition<SunburstNode>().size([2 * Math.PI, radius])(root);
    return laidOut.descendants().filter((d) => d.depth > 0);
  }, [data]);

  if (!data.children || data.children.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-text-muted">
        No responses yet.
      </div>
    );
  }

  const arcGen = d3arc<HierarchyRectangularNode<SunburstNode>>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1)
    .padAngle(0.005)
    .padRadius(SIZE / 4);

  function colorFor(node: HierarchyRectangularNode<SunburstNode>): string {
    if (node.depth === 3) return SENTIMENT_COLORS[node.data.name] ?? '#94A3B8';
    const topAncestor = node.ancestors().find((a) => a.depth === 1);
    const idx = data.children!.findIndex((c) => c.name === topAncestor?.data.name);
    const base = REGION_PALETTE[idx % REGION_PALETTE.length];
    return node.depth === 1 ? base : `${base}99`; // sub-region ring: same hue, softened
  }

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height={280}>
      <g transform={`translate(${SIZE / 2}, ${SIZE / 2})`}>
        {nodes.map((node, i) => {
          const d = arcGen(node);
          if (!d) return null;
          return (
            <path key={i} d={d} fill={colorFor(node)} stroke="#FFFFFF" strokeWidth={1}>
              <title>{`${node.data.name}: ${node.value}`}</title>
            </path>
          );
        })}
      </g>
    </svg>
  );
}
