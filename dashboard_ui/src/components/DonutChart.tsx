// ---------------------------------------------------------------------------
// DonutChart – lightweight SVG donut chart (no external lib)
// ---------------------------------------------------------------------------

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface SlicePath extends Slice {
  start: number;
  end: number;
}

interface DonutChartProps {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle - 90));
  const y1 = cy + r * Math.sin(toRad(startAngle - 90));
  const x2 = cx + r * Math.cos(toRad(endAngle - 90));
  const y2 = cy + r * Math.sin(toRad(endAngle - 90));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function buildPaths(slices: Slice[], total: number): SlicePath[] {
  return slices.reduce<SlicePath[]>((acc, sl) => {
    const prev = acc[acc.length - 1];
    const startAngle = prev ? prev.end + 0.5 : 0;
    const sweep = (sl.value / total) * 360;
    acc.push({ ...sl, start: startAngle, end: startAngle + sweep - 0.5 });
    return acc;
  }, []);
}

export function DonutChart({ slices, size = 140, thickness = 26, centerLabel }: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const paths = buildPaths(slices, total);

  return (
    <figure style={{ margin: 0 }}>
      <svg width={size} height={size} aria-label="Donut chart" role="img">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
        {paths.map((p) => (
          <path
            key={p.label}
            d={describeArc(cx, cy, r, p.start, p.end)}
            fill="none"
            stroke={p.color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        ))}
        {centerLabel && (
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#f8fafc" fontSize={13} fontWeight={600} fontFamily="Inter, sans-serif">
            {centerLabel}
          </text>
        )}
      </svg>
      {/* Legend */}
      <figcaption>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {slices.map((sl) => (
            <li key={sl.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: sl.color, display: 'inline-block' }} />
              {sl.label}: <strong style={{ color: '#f1f5f9' }}>{sl.value}</strong>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
