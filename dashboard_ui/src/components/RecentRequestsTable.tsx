// ---------------------------------------------------------------------------
// RecentRequestsTable – Matches the Stitch reference layout & styling
// ---------------------------------------------------------------------------
import { useState } from 'react';
import type { TelemetryEntry } from '../types';

interface RecentRequestsTableProps {
  logs: TelemetryEntry[];
  isDemoMode?: boolean;
}

interface RequestRow {
  id: string;
  time: string;
  model: string;
  route: string;
  latency: string;
  isFastLatency: boolean;
  isFailoverLatency: boolean;
  statusType: 'hit' | 'miss' | 'failover';
  statusLabel: string;
}

export function RecentRequestsTable({ logs, isDemoMode }: RecentRequestsTableProps) {
  const [filter, setFilter] = useState<'all' | 'hit' | 'miss' | 'failover'>('all');

  // Demo requests matching the exact Stitch reference
  const demoRows: RequestRow[] = [
    {
      id: 'demo-1',
      time: '14:22:08.104',
      model: 'gpt-4o-mini',
      route: 'Cache → Qdrant (sim: 0.96)',
      latency: '18ms',
      isFastLatency: true,
      isFailoverLatency: false,
      statusType: 'hit',
      statusLabel: '200 OK • HIT',
    },
    {
      id: 'demo-2',
      time: '14:22:07.892',
      model: 'claude-3-5-sonnet',
      route: 'Direct → OpenAI',
      latency: '482ms',
      isFastLatency: false,
      isFailoverLatency: false,
      statusType: 'miss',
      statusLabel: '200 OK • MISS',
    },
    {
      id: 'demo-3',
      time: '14:22:07.410',
      model: 'deepseek-chat',
      route: 'Failover → Bedrock Haiku',
      latency: '192ms (reroute)',
      isFastLatency: false,
      isFailoverLatency: true,
      statusType: 'failover',
      statusLabel: 'RESOLVED • FAILOVER',
    },
    {
      id: 'demo-4',
      time: '14:22:06.945',
      model: 'text-embedding-3-small',
      route: 'Cache → In-memory',
      latency: '9ms',
      isFastLatency: true,
      isFailoverLatency: false,
      statusType: 'hit',
      statusLabel: '200 OK • HIT',
    },
    {
      id: 'demo-5',
      time: '14:22:06.120',
      model: 'llama-3-70b-instruct',
      route: 'Direct → DeepInfra',
      latency: '340ms',
      isFastLatency: false,
      isFailoverLatency: false,
      statusType: 'miss',
      statusLabel: '200 OK • MISS',
    },
    {
      id: 'demo-6',
      time: '14:22:05.780',
      model: 'gpt-4o-mini',
      route: 'Cache → Qdrant (sim: 0.94)',
      latency: '24ms',
      isFastLatency: true,
      isFailoverLatency: false,
      statusType: 'hit',
      statusLabel: '200 OK • HIT',
    },
  ];

  // Map real backend logs to the Stitch table schema
  const realRows: RequestRow[] = logs.map((log) => {
    let route: string;
    let statusType: 'hit' | 'miss' | 'failover' = 'miss';
    let statusLabel = '200 OK • MISS';

    if (log.cache_hit) {
      route = `Cache → Redis (sim: ${log.similarity_score.toFixed(2)})`;
      statusType = 'hit';
      statusLabel = '200 OK • HIT';
    } else if (log.failover_triggered) {
      route = 'Failover → Groq Llama-3.1';
      statusType = 'failover';
      statusLabel = 'RESOLVED • FAILOVER';
    } else {
      route = `Direct → ${log.model_used.replace('gemini/', '')}`;
    }

    const isFast = log.cache_hit || log.total_latency_ms < 50;
    const latencyStr = log.failover_triggered
      ? `${log.total_latency_ms.toFixed(0)}ms (reroute)`
      : `${log.total_latency_ms.toFixed(0)}ms`;

    return {
      id: log.request_id,
      time: log.timestamp || '14:22:00.000',
      model: log.model_used,
      route,
      latency: latencyStr,
      isFastLatency: isFast,
      isFailoverLatency: log.failover_triggered,
      statusType,
      statusLabel,
    };
  });

  const rows = isDemoMode ? demoRows : realRows;

  const filteredRows = rows.filter((r) => {
    if (filter === 'hit') return r.statusType === 'hit';
    if (filter === 'miss') return r.statusType === 'miss';
    if (filter === 'failover') return r.statusType === 'failover';
    return true;
  });

  return (
    <div className="recent-requests-card">
      <div className="recent-requests-header">
        <div className="recent-requests-left">
          <h3 className="recent-requests-title">Recent Requests</h3>
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'filter-tab--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${filter === 'hit' ? 'filter-tab--active' : ''}`}
              onClick={() => setFilter('hit')}
            >
              Cache Hit
            </button>
            <button
              className={`filter-tab ${filter === 'miss' ? 'filter-tab--active' : ''}`}
              onClick={() => setFilter('miss')}
            >
              Cache Miss
            </button>
            <button
              className={`filter-tab ${filter === 'failover' ? 'filter-tab--active' : ''}`}
              onClick={() => setFilter('failover')}
            >
              Failover
            </button>
          </div>
        </div>

        <button
          className="view-all-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => setFilter('all')}
        >
          View all in Requests &rarr;
        </button>
      </div>

      <div className="table-responsive">
        <table className="stitch-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>MODEL</th>
              <th>ROUTE / PROVIDER</th>
              <th>LATENCY</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  {rows.length === 0
                    ? 'No requests recorded yet. Run the benchmark to populate telemetry.'
                    : `No requests matching "${filter === 'hit' ? 'Cache Hit' : filter === 'miss' ? 'Cache Miss' : filter === 'failover' ? 'Failover' : 'All'}"`}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={`${row.id}-${idx}`}>
                  <td className="cell-time">{row.time}</td>
                  <td className="cell-model">{row.model}</td>
                  <td className="cell-route">{row.route}</td>
                  <td
                    className={`cell-latency ${
                      row.isFastLatency
                        ? 'cell-latency--fast'
                        : row.isFailoverLatency
                        ? 'cell-latency--failover'
                        : ''
                    }`}
                  >
                    {row.latency}
                  </td>
                  <td>
                    <span className={`table-status-pill table-status-pill--${row.statusType}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
