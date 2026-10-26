// ---------------------------------------------------------------------------
// RouteMesh Dashboard – shared TypeScript types
// ---------------------------------------------------------------------------

export interface TelemetryEntry {
  request_id: string;
  timestamp: string;
  prompt_preview: string;
  cache_hit: boolean;
  similarity_score: number;
  router_latency_ms: number;
  tier: 'fast' | 'reasoning';
  model_used: string;
  failover_triggered: boolean;
  total_latency_ms: number;
  estimated_cost_usd: number;
  baseline_cost_usd: number;
}

export interface StatsResponse {
  total_requests: number;
  cache_hits: number;
  cache_hit_rate_pct: number;
  failovers_handled: number;
  actual_spend_usd: number;
  baseline_spend_usd: number;
  total_saved_usd: number;
  avg_latency_ms: number;
  chaos_outage_active: boolean;
  recent_logs: TelemetryEntry[];
}

export interface BenchmarkResponse {
  benchmark_completed: number;
  results: TelemetryEntry[];
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
