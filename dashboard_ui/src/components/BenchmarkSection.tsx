// ---------------------------------------------------------------------------
// BenchmarkSection – run the /api/benchmark/run endpoint and display results
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { api } from '../api';
import type { BenchmarkResponse } from '../types';

interface BenchmarkSectionProps {
  onComplete: () => void; // refresh parent stats after run
}

export function BenchmarkSection({ onComplete }: BenchmarkSectionProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.runBenchmark();
      setResult(res);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }

  const summary = result
    ? (() => {
        const hits = result.results.filter((r) => r.cache_hit).length;
        const failovers = result.results.filter((r) => r.failover_triggered).length;
        const actualSpend = result.results.reduce((s, r) => s + r.estimated_cost_usd, 0);
        const baselineSpend = result.results.reduce((s, r) => s + r.baseline_cost_usd, 0);
        const saved = baselineSpend - actualSpend;
        const avgLat =
          result.results.reduce((s, r) => s + r.total_latency_ms, 0) / result.results.length;
        return { hits, failovers, saved, avgLat };
      })()
    : null;

  return (
    <section className="section" aria-label="Benchmark">
      <h2 className="section-title">Benchmark Suite</h2>
      <div className="card">
        <p className="card-sub" style={{ marginBottom: 16 }}>
          Runs the built-in set of 10 prompts (including paraphrased pairs and complexity tiers)
          against the live gateway to demonstrate semantic caching, routing, and failover.
        </p>

        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={running}
          aria-busy={running}
        >
          {running ? (
            <>
              <span className="spinner-sm" aria-hidden="true" /> Running benchmark…
            </>
          ) : (
            '▶ Run Benchmark'
          )}
        </button>

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Benchmark failed:</strong> {error}
          </div>
        )}

        {result && summary && (
          <div className="benchmark-results">
            <h3 className="card-title" style={{ marginTop: 24 }}>
              Results — {result.benchmark_completed} requests completed
            </h3>
            <div className="bench-grid">
              <div className="bench-stat">
                <p className="bench-label">Cache Hits</p>
                <p className="bench-value" style={{ color: '#34d399' }}>{summary.hits}</p>
              </div>
              <div className="bench-stat">
                <p className="bench-label">Provider Calls Avoided</p>
                <p className="bench-value" style={{ color: '#22d3ee' }}>{summary.hits}</p>
              </div>
              <div className="bench-stat">
                <p className="bench-label">Failovers</p>
                <p className="bench-value" style={{ color: '#fbbf24' }}>{summary.failovers}</p>
              </div>
              <div className="bench-stat">
                <p className="bench-label">Avg Latency</p>
                <p className="bench-value">{summary.avgLat.toFixed(1)} ms</p>
              </div>
              <div className="bench-stat">
                <p className="bench-label">Estimated Savings</p>
                <p className="bench-value" style={{ color: '#34d399' }}>\${summary.saved.toFixed(4)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
