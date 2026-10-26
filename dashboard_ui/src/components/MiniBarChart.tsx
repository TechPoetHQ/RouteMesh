// ---------------------------------------------------------------------------
// MiniBarChart – lightweight SVG bar chart (no external lib)
// ---------------------------------------------------------------------------

interface Bar {
  label: string;
  value: number;
  color: string;
}

interface MiniBarChartProps {
  bars: Bar[];
  unit?: string;
  height?: number;
}

export function MiniBarChart({ bars, unit = '', height = 120 }: MiniBarChartProps) {
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const barWidth = 36;
  const gap = 20;
  const svgWidth = bars.length * (barWidth + gap) + gap;
  const chartHeight = height - 32; // reserve space for labels

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${height}`}
      aria-label="Bar chart"
      role="img"
      style={{ overflow: 'visible' }}
    >
      {bars.map((bar, i) => {
        const barH = Math.max((bar.value / maxVal) * chartHeight, 2);
        const x = gap + i * (barWidth + gap);
        const y = chartHeight - barH;
        return (
          <g key={bar.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={4}
              fill={bar.color}
              opacity={0.85}
            />
            {/* Value label above bar */}
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize={10}
              fontFamily="Inter, sans-serif"
            >
              {bar.value.toFixed(1)}{unit}
            </text>
            {/* X axis label */}
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fill="#64748b"
              fontSize={9}
              fontFamily="Inter, sans-serif"
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
