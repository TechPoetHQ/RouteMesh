// ---------------------------------------------------------------------------
// KpiCard – Compact metric card matching the Stitch light design
// ---------------------------------------------------------------------------
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  valueColor?: string;
}

export function KpiCard({ label, value, sub, icon, valueColor }: KpiCardProps) {
  return (
    <div className="stitch-kpi-card">
      <div className="stitch-kpi-header">
        <span className="stitch-kpi-label">{label}</span>
        <span className="stitch-kpi-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="stitch-kpi-body">
        <div className="stitch-kpi-value" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        {sub && <div className="stitch-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}
