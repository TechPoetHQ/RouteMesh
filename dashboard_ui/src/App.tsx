import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { api } from './api';
import type { StatsResponse, ConnectionStatus } from './types';
import { KpiCard } from './components/KpiCard';
import { RequestActivityChart } from './components/RequestActivityChart';
import { ProviderHealthCard } from './components/ProviderHealthCard';
import { RecentRequestsTable } from './components/RecentRequestsTable';

const POLL_INTERVAL_MS = 15_000;

export function App() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [activeNav, setActiveNav] = useState<'overview' | 'requests' | 'providers'>('overview');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkSummary, setBenchmarkSummary] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  // Initial load + polling with cleanup
  useEffect(() => {
    let ignore = false;

    api.getStats()
      .then((data) => {
        if (!ignore) {
          setStats(data);
          setStatus('online');
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus('offline');
        }
      });

    const unsubscribeSse = api.subscribeTelemetry((entry) => {
      if (!ignore) {
        setStats((prev) => {
          if (!prev) return prev;
          const updatedLogs = [entry, ...prev.recent_logs.slice(0, 29)];
          const total = prev.total_requests + 1;
          const hits = prev.cache_hits + (entry.cache_hit ? 1 : 0);
          const failovers = prev.failovers_handled + (entry.failover_triggered ? 1 : 0);
          const actualSpend = +(prev.actual_spend_usd + entry.estimated_cost_usd).toFixed(4);
          const baseSpend = +(prev.baseline_spend_usd + entry.baseline_cost_usd).toFixed(4);
          const saved = +(baseSpend - actualSpend).toFixed(4);
          const avgLat = +((prev.avg_latency_ms * prev.total_requests + entry.total_latency_ms) / total).toFixed(1);
          return {
            ...prev,
            total_requests: total,
            cache_hits: hits,
            cache_hit_rate_pct: +((hits / total) * 100).toFixed(1),
            failovers_handled: failovers,
            actual_spend_usd: actualSpend,
            baseline_spend_usd: baseSpend,
            total_saved_usd: saved,
            avg_latency_ms: avgLat,
            recent_logs: updatedLogs,
          };
        });
      }
    });

    const interval = setInterval(() => {
      void fetchStats();
    }, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      clearInterval(interval);
      unsubscribeSse();
    };
  }, [fetchStats]);

  const handleManualRefresh = () => {
    void fetchStats();
  };

  const handleRunBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkSummary(null);
    try {
      const res = await api.runBenchmark();
      setIsDemoMode(false);
      await fetchStats();
      const total = res.results.length;
      const hits = res.results.filter((r) => r.cache_hit).length;
      const externalCallsAvoided = hits;
      const fastCount = res.results.filter((r) => r.tier === 'fast').length;
      const reasoningCount = res.results.filter((r) => r.tier === 'reasoning').length;
      const failovers = res.results.filter((r) => r.failover_triggered).length;
      const avgLat = Math.round(
        res.results.reduce((s, r) => s + r.total_latency_ms, 0) / (total || 1)
      );
      const latSaved = Math.max(0, 980 - avgLat);
      const actualCost = res.results.reduce((s, r) => s + r.estimated_cost_usd, 0);
      const baseCost = res.results.reduce((s, r) => s + r.baseline_cost_usd, 0);
      const costSaved = Math.max(0, baseCost - actualCost);

      const suiteLabel = `${total} prompts`;
      setBenchmarkSummary(
        `Benchmark Evidence (${suiteLabel}): ${hits}/${total} Cache Hits (${externalCallsAvoided} API calls avoided) • ${fastCount} Fast / ${reasoningCount} Reasoning • Avg Latency: ${avgLat}ms (-${latSaved}ms vs ~980ms direct) • Saved: $${costSaved.toFixed(4)} • Failovers: ${failovers}`
      );
    } catch (e) {
      setBenchmarkSummary(`Benchmark error: ${e instanceof Error ? e.message : 'Failed to run'}`);
    } finally {
      setBenchmarkRunning(false);
    }
  };

  // Determine whether to show live vs demo values
  // If backend is connected and has requests, use live data unless user explicitly toggled demo mode
  const hasLiveLogs = stats !== null && stats.total_requests > 0;
  const effectiveDemoMode = isDemoMode || (!hasLiveLogs && status === 'offline');

  // Metric 1: Total Requests & Automatic Failovers Handled
  const totalRequestsValue = effectiveDemoMode
    ? '142,891'
    : stats
    ? stats.total_requests.toLocaleString()
    : '0';
  const totalRequestsSub = effectiveDemoMode
    ? '48.2 req/sec • 99.98% SLA'
    : stats && stats.total_requests > 0
    ? `${stats.failovers_handled} failovers handled • ${(stats.total_requests / 60).toFixed(1)} req/sec`
    : '0 failovers handled • Awaiting traffic';

  // Metric 2: Cache Hit Rate & Estimated Dollar Spend Saved
  const cacheHitRateValue = effectiveDemoMode
    ? '68.4%'
    : stats
    ? `${stats.cache_hit_rate_pct.toFixed(1)}%`
    : '0.0%';
  const cacheHitRateSub = effectiveDemoMode
    ? 'Cosine sim ≥ 0.92 • 97,737 hits'
    : stats && stats.total_requests > 0
    ? `Saved $${stats.total_saved_usd.toFixed(4)} • ${stats.cache_hits.toLocaleString()} hits (sim ≥ 0.92)`
    : 'Cosine sim ≥ 0.92 • $0.0000 saved';

  // Metric 3: Average Latency & Average Latency Saved
  const avgLatencyValue = effectiveDemoMode
    ? '142 ms'
    : stats && stats.avg_latency_ms > 0
    ? `${stats.avg_latency_ms.toFixed(0)} ms`
    : '—';
  const latencySavedMs = stats && stats.avg_latency_ms > 0
    ? Math.max(0, Math.round(980 - stats.avg_latency_ms))
    : 0;
  const avgLatencySub = effectiveDemoMode
    ? 'P50 68ms • P95 295ms (Direct: 840ms)'
    : stats && stats.avg_latency_ms > 0
    ? `Saved ${latencySavedMs}ms vs direct (~980ms)`
    : 'P50 — • P95 —';

  const cacheHitRateNum = effectiveDemoMode
    ? 68.4
    : stats
    ? stats.cache_hit_rate_pct
    : 0;

  return (
    <div className="stitch-layout">
      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <aside className="stitch-sidebar" aria-label="Main Navigation">
        <nav className="stitch-nav">
          <button
            className={`stitch-nav-item ${activeNav === 'overview' ? 'stitch-nav-item--active' : ''}`}
            onClick={() => {
              setActiveNav('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Overview</span>
          </button>

          <button
            className={`stitch-nav-item ${activeNav === 'requests' ? 'stitch-nav-item--active' : ''}`}
            onClick={() => {
              setActiveNav('requests');
              document.querySelector('.recent-requests-card')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>Requests</span>
          </button>

          <button
            className={`stitch-nav-item ${activeNav === 'providers' ? 'stitch-nav-item--active' : ''}`}
            onClick={() => {
              setActiveNav('providers');
              document.querySelector('.provider-health-card')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <span>Providers</span>
          </button>
        </nav>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────── */}
      <main className="stitch-main">
        {/* Top Header */}
        <header className="stitch-topbar">
          <div className="stitch-topbar-left">
            <h1 className="stitch-page-title">Gateway Overview</h1>

            
          </div>

          <div className="stitch-topbar-right">
            {/* View Mode Toggle Button */}
            <button
              className="toggle-mode-btn"
              onClick={() => setIsDemoMode(!isDemoMode)}
              title="Toggle between Stitch demonstration layout and live backend telemetry"
            >
              {effectiveDemoMode ? 'View Live Telemetry' : 'View Stitch Demo'}
            </button>

            {/* Time range selector */}
            <div className="time-filter-group">
              <button
                className={`time-filter-btn ${timeRange === '1h' ? 'time-filter-btn--active' : ''}`}
                onClick={() => setTimeRange('1h')}
              >
                Last 1 hour
              </button>
              <button
                className={`time-filter-btn ${timeRange === '6h' ? 'time-filter-btn--active' : ''}`}
                onClick={() => setTimeRange('6h')}
              >
                6 hours
              </button>
              <button
                className={`time-filter-btn ${timeRange === '24h' ? 'time-filter-btn--active' : ''}`}
                onClick={() => setTimeRange('24h')}
              >
                24 hours
              </button>
            </div>

            {/* Benchmark action button */}
            <button
              className="action-btn action-btn--primary"
              onClick={handleRunBenchmark}
              disabled={benchmarkRunning}
              aria-busy={benchmarkRunning}
            >
              {benchmarkRunning ? (
                <>
                  <span className="spinner-icon" aria-hidden="true" />
                  Running…
                </>
              ) : (
                '▶ Run Benchmark'
              )}
            </button>

            {/* Refresh button */}
            <button
              className="action-btn action-btn--icon"
              onClick={handleManualRefresh}
              title="Refresh telemetry"
              aria-label="Refresh telemetry"
            >
              ↻
            </button>
          </div>
        </header>

        {/* Benchmark notice banner if recently executed */}
        {benchmarkSummary && (
          <div className="stitch-alert">
            <span>{benchmarkSummary}</span>
            <button className="stitch-alert-close" onClick={() => setBenchmarkSummary(null)}></button>
          </div>
        )}

        {/* ── Three Compact Metric Cards ─────────────────────────── */}
        <section className="stitch-metrics-row" aria-label="Key Performance Indicators">
          <KpiCard
            label="TOTAL REQUESTS"
            value={totalRequestsValue}
            sub={totalRequestsSub}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            }
          />

          <KpiCard
            label="CACHE HIT RATE"
            value={cacheHitRateValue}
            sub={cacheHitRateSub}
            valueColor="#16a34a"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
          />

          <KpiCard
            label="AVERAGE LATENCY"
            value={avgLatencyValue}
            sub={avgLatencySub}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
        </section>

        {/* ── Middle Row: Request Activity Chart & Provider Health ── */}
        <section className="stitch-middle-grid" aria-label="Telemetry Activity and Providers">
          <RequestActivityChart
            logs={stats?.recent_logs ?? []}
            cacheHitRatePct={cacheHitRateNum}
            isDemoMode={effectiveDemoMode}
          />

          <ProviderHealthCard
            chaosActive={stats?.chaos_outage_active ?? false}
            onToggleChaos={handleManualRefresh}
            isDemoMode={effectiveDemoMode}
            isOffline={status === 'offline'}
            logs={stats?.recent_logs}
          />
        </section>

        {/* ── Bottom Row: Recent Requests Table ───────────────────── */}
        <section className="stitch-bottom-section" aria-label="Recent Requests">
          <RecentRequestsTable
            logs={stats?.recent_logs ?? []}
            isDemoMode={effectiveDemoMode}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
