// ---------------------------------------------------------------------------
// TelemetryTable – request telemetry log table
// ---------------------------------------------------------------------------
import type { TelemetryEntry } from '../types';
import { StatusBadge } from './StatusBadge';

interface TelemetryTableProps {
  logs: TelemetryEntry[];
  loading: boolean;
  error: string | null;
}

export function TelemetryTable({ logs, loading, error }: TelemetryTableProps) {
  if (loading) {
    return (
      <div className="table-state">
        <div className="spinner" aria-label="Loading" />
        <p>Loading telemetry…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-state table-state--error">
        <p>⚠ Unable to load telemetry</p>
        <p className="table-state__detail">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="table-state">
        <p style={{ fontSize: 24 }}>📭</p>
        <p>No requests recorded yet.</p>
        <p className="table-state__detail">Send a request to the gateway or run the benchmark to populate this table.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="tel-table" aria-label="Request telemetry">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Time</th>
            <th>Cache Hit</th>
            <th>Similarity</th>
            <th>Tier</th>
            <th>Model</th>
            <th>Latency (ms)</th>
            <th>Failover</th>
            <th>Cost Saved</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((row) => {
            const saved = row.baseline_cost_usd - row.estimated_cost_usd;
            return (
              <tr key={row.request_id}>
                <td className="mono">{row.request_id}</td>
                <td className="mono">{row.timestamp}</td>
                <td><StatusBadge value={row.cache_hit} trueLabel="✓ Hit" falseLabel="Miss" /></td>
                <td className="mono">
                  {row.cache_hit ? row.similarity_score.toFixed(4) : '—'}
                </td>
                <td><StatusBadge value={row.tier} variant="tier" /></td>
                <td className="model-cell" title={row.model_used}>{row.model_used}</td>
                <td className="mono">{row.total_latency_ms.toFixed(1)}</td>
                <td><StatusBadge value={row.failover_triggered} trueLabel="Yes" falseLabel="—" variant="failover" /></td>
                <td className="mono">
                  {saved > 0 ? (
                    <span style={{ color: '#34d399' }}>\${saved.toFixed(4)}</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
