// ---------------------------------------------------------------------------
// AnalyticsSection – performance charts derived from telemetry
// ---------------------------------------------------------------------------
import type { TelemetryEntry } from '../types';
import { MiniBarChart } from './MiniBarChart';
import { DonutChart } from './DonutChart';

interface AnalyticsSectionProps {
  logs: TelemetryEntry[];
  avgLatency: number;
}

const BASELINE_LATENCY_MS = 980; // representative baseline without RouteMesh

export function AnalyticsSection({ logs, avgLatency }: AnalyticsSectionProps) {
  const fastCount = logs.filter((l) => l.tier === 'fast').length;
  const reasoningCount = logs.filter((l) => l.tier === 'reasoning').length;
  const hitCount = logs.filter((l) => l.cache_hit).length;
  const missCount = logs.length - hitCount;

  const latencyBars = [
    { label: 'Baseline', value: BASELINE_LATENCY_MS, color: '#475569' },
    { label: 'RouteMesh', value: avgLatency > 0 ? avgLatency : 0, color: '#818cf8' },
  ];

  const tierSlices = [
    { label: 'Fast', value: fastCount, color: '#22d3ee' },
    { label: 'Reasoning', value: reasoningCount, color: '#818cf8' },
  ];

  const cacheSlices = [
    { label: 'Hit', value: hitCount, color: '#34d399' },
    { label: 'Miss', value: missCount, color: '#475569' },
  ];

  const hasData = logs.length > 0;

  return (
    <section className="section" aria-label="Performance analytics">
      <h2 className="section-title">Performance Analytics</h2>
      <div className="analytics-grid">

        {/* Latency comparison */}
        <div className="card analytics-card">
          <h3 className="card-title">Latency Comparison</h3>
          <p className="card-sub">Average response time (ms)</p>
          {hasData ? (
            <MiniBarChart bars={latencyBars} unit=" ms" height={140} />
          ) : (
            <p className="empty-chart">No data yet</p>
          )}
          <p className="chart-note">
            Baseline assumes ~980 ms for a direct provider call (typical GPT-4 round-trip).
          </p>
        </div>

        {/* Routing tier distribution */}
        <div className="card analytics-card">
          <h3 className="card-title">Routing Tier Distribution</h3>
          <p className="card-sub">Fast vs Reasoning model usage</p>
          {hasData ? (
            <DonutChart
              slices={tierSlices}
              centerLabel={`${logs.length}`}
              size={130}
              thickness={24}
            />
          ) : (
            <p className="empty-chart">No data yet</p>
          )}
        </div>

        {/* Cache hit distribution */}
        <div className="card analytics-card">
          <h3 className="card-title">Cache Hit Distribution</h3>
          <p className="card-sub">Semantic cache effectiveness</p>
          {hasData ? (
            <DonutChart
              slices={cacheSlices}
              centerLabel={logs.length > 0 ? `${Math.round((hitCount / logs.length) * 100)}%` : '0%'}
              size={130}
              thickness={24}
            />
          ) : (
            <p className="empty-chart">No data yet</p>
          )}
        </div>

      </div>
    </section>
  );
}
