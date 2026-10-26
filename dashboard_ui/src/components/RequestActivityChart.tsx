// ---------------------------------------------------------------------------
// RequestActivityChart – Dual-line SVG chart matching the Stitch design
// ---------------------------------------------------------------------------
import type { TelemetryEntry } from '../types';

interface RequestActivityChartProps {
  logs: TelemetryEntry[];
  cacheHitRatePct: number;
  isDemoMode?: boolean;
}

interface ChartPoint {
  timeLabel: string;
  total: number;
  hits: number;
}

export function RequestActivityChart({ logs, cacheHitRatePct, isDemoMode }: RequestActivityChartProps) {
  // Demo baseline series matching the Stitch screenshot
  const demoSeries: ChartPoint[] = [
    { timeLabel: '00:00', total: 1100, hits: 720 },
    { timeLabel: '00:08', total: 1400, hits: 880 },
    { timeLabel: '00:15', total: 1300, hits: 820 },
    { timeLabel: '00:23', total: 1550, hits: 1050 },
    { timeLabel: '00:30', total: 1720, hits: 1180 },
    { timeLabel: '00:38', total: 1450, hits: 960 },
    { timeLabel: '00:45', total: 1900, hits: 1320 },
    { timeLabel: '00:53', total: 1800, hits: 1210 },
    { timeLabel: '01:00', total: 2000, hits: 1400 },
  ];

  const emptySeries: ChartPoint[] = [
    { timeLabel: '00:00', total: 0, hits: 0 },
    { timeLabel: '00:15', total: 0, hits: 0 },
    { timeLabel: '00:30', total: 0, hits: 0 },
    { timeLabel: '00:45', total: 0, hits: 0 },
    { timeLabel: '01:00', total: 0, hits: 0 },
  ];

  // Derive points from real telemetry logs if available and not demo mode
  let points: ChartPoint[] = isDemoMode ? demoSeries : emptySeries;
  if (!isDemoMode && logs.length > 0) {
    // Group recent logs into chronological buckets (up to 7 buckets)
    const reversed = [...logs].reverse();
    const bucketSize = Math.max(1, Math.ceil(reversed.length / 7));
    const realBuckets: ChartPoint[] = [];

    for (let i = 0; i < reversed.length; i += bucketSize) {
      const slice = reversed.slice(i, i + bucketSize);
      const total = slice.length;
      const hits = slice.filter((l) => l.cache_hit).length;
      const timeLabel = slice[slice.length - 1].timestamp || `T${realBuckets.length + 1}`;
      realBuckets.push({ timeLabel, total, hits });
    }

    if (realBuckets.length >= 2) {
      points = realBuckets;
    }
  }

  // Calculate scaling
  const maxVal = Math.max(...points.map((p) => p.total), 1);
  const chartHeight = 160;
  const chartWidth = 560;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;

  const plotW = chartWidth - paddingLeft - paddingRight;
  const plotH = chartHeight - paddingTop - paddingBottom;

  // Y-ticks
  const yTicks = [
    { label: maxVal >= 1000 ? `${(maxVal / 1000).toFixed(1)}k` : `${Math.round(maxVal)}`, val: maxVal },
    { label: maxVal >= 1000 ? `${(maxVal * 0.75 / 1000).toFixed(1)}k` : `${Math.round(maxVal * 0.75)}`, val: maxVal * 0.75 },
    { label: maxVal >= 1000 ? `${(maxVal * 0.5 / 1000).toFixed(1)}k` : `${Math.round(maxVal * 0.5)}`, val: maxVal * 0.5 },
    { label: maxVal >= 1000 ? `${(maxVal * 0.25 / 1000).toFixed(1)}k` : `${Math.round(maxVal * 0.25)}`, val: maxVal * 0.25 },
    { label: '0', val: 0 },
  ];

  const getX = (idx: number) => paddingLeft + (idx / (points.length - 1)) * plotW;
  const getY = (val: number) => paddingTop + plotH - (val / maxVal) * plotH;

  // Build path strings
  const totalPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.total).toFixed(1)}`)
    .join(' ');

  const hitsPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.hits).toFixed(1)}`)
    .join(' ');

  const hitPctDisplay = Math.round(cacheHitRatePct);

  return (
    <div className="activity-card">
      <div className="activity-header">
        <div>
          <h3 className="activity-title">Request Activity</h3>
          <p className="activity-sub">Volume &amp; cache distribution (req/min)</p>
        </div>
        <div className="activity-legend">
          <div className="legend-item">
            <span className="legend-line legend-line-blue" />
            <span className="legend-dot legend-dot-blue" />
            <span className="legend-text">Total Requests</span>
          </div>
          <div className="legend-item">
            <span className="legend-line legend-line-green-dashed" />
            <span className="legend-dot legend-dot-green" />
            <span className="legend-text">Cache Hits ({hitPctDisplay}%)</span>
          </div>
        </div>
      </div>

      <div className="activity-chart-wrap">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="activity-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Request volume and cache distribution timeline"
        >
          {/* Horizontal grid lines & Y labels */}
          {yTicks.map((tick, i) => {
            const y = getY(tick.val);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fill="#94a3b8"
                  fontFamily="Inter, sans-serif"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Dotted green line for Cache Hits */}
          <path
            d={hitsPath}
            fill="none"
            stroke="#16a34a"
            strokeWidth="1.8"
            strokeDasharray="3 3"
          />

          {/* Solid blue line for Total Requests */}
          <path
            d={totalPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
          />

          {/* Points for Total Requests */}
          {points.map((p, i) => (
            <circle
              key={`tot-${i}`}
              cx={getX(i)}
              cy={getY(p.total)}
              r="3.5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2"
            />
          ))}

          {/* Points for Cache Hits */}
          {points.map((p, i) => (
            <circle
              key={`hit-${i}`}
              cx={getX(i)}
              cy={getY(p.hits)}
              r="2.5"
              fill="#16a34a"
            />
          ))}

          {/* X-axis labels */}
          {points.map((p, i) => {
            // Show every alternate label if many points
            if (points.length > 5 && i % 2 !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={`lbl-${i}`}
                x={getX(i)}
                y={chartHeight - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
                fontFamily="Inter, sans-serif"
              >
                {p.timeLabel}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
