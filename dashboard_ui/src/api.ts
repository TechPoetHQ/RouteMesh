// ---------------------------------------------------------------------------
// RouteMesh Dashboard – API client
// All API calls go through this module. The base URL is set via the
// VITE_API_BASE_URL environment variable (defaults to http://localhost:8000).
// ---------------------------------------------------------------------------

import type { StatsResponse, BenchmarkResponse, TelemetryEntry } from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  getStats: () => get<StatsResponse>('/api/stats'),
  runBenchmark: () => post<BenchmarkResponse>('/api/benchmark/run'),
  toggleChaos: () => post<{ chaos_outage_active: boolean }>('/api/chaos/toggle'),
  clearCache: () => post<{ status: string }>('/api/cache/clear'),
  subscribeTelemetry: (
    onData: (data: TelemetryEntry) => void,
    onError?: () => void
  ): (() => void) => {
    if (typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource(`${BASE}/api/telemetry/stream`);
        es.onmessage = (event) => {
          try {
            const entry = JSON.parse(event.data) as TelemetryEntry;
            onData(entry);
          } catch {
            // Ignore heartbeat or non-json
          }
        };
        es.onerror = () => {
          es.close();
          onError?.();
        };
        return () => es.close();
      } catch {
        onError?.();
      }
    }
    return () => {};
  },
};
