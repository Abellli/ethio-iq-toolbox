'use client';

import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { HeatmapPoint } from '@/lib/api';

// Centered on Addis Ababa — swap for a survey-specific centroid later if
// pilots expand beyond the capital.
const INITIAL_VIEW_STATE = {
  longitude: 38.7636,
  latitude: 9.0084,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

export function ResponseHeatmap({ points }: { points: HeatmapPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-card bg-primary-tint text-sm text-text-muted">
        No geo-tagged responses yet.
      </div>
    );
  }

  const tileLayer = new TileLayer({
    id: 'osm-tiles',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props: any) => {
      const { boundingBox } = props.tile;
      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    },
  });

  const heatmapLayer = new HeatmapLayer({
    id: 'response-heatmap',
    data: points,
    getPosition: (d: HeatmapPoint) => [d.lng, d.lat],
    getWeight: (d: HeatmapPoint) => d.weight,
    radiusPixels: 40,
    // Design-token colors, cool to hot: primary-tint → primary → coral.
    colorRange: [
      [227, 242, 253, 60],
      [144, 202, 249, 120],
      [33, 150, 243, 180],
      [251, 113, 133, 220],
    ],
  });

  return (
    <div className="relative h-72 overflow-hidden rounded-card">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={[tileLayer, heatmapLayer]}
        style={{ position: 'relative', height: '100%', width: '100%' }}
      />
      <span className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-text-muted">
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
