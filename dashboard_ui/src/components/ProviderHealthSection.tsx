// ---------------------------------------------------------------------------
// ProviderHealthSection – chaos toggle + provider health status
// ---------------------------------------------------------------------------
import { useState } from 'react';
import { api } from '../api';

interface ProviderHealthSectionProps {
  chaosActive: boolean;
  onToggle: () => void; // refresh parent stats
}

export function ProviderHealthSection({ chaosActive, onToggle }: ProviderHealthSectionProps) {
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setToggling(true);
    setError(null);
    try {
      await api.toggleChaos();
      onToggle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setToggling(false);
    }
  }

  const providers = [
    {
      name: 'Gemini 2.5 Flash',
      role: 'Primary – Fast Tier',
      status: chaosActive ? 'degraded' : 'healthy',
    },
    {
      name: 'Gemini 2.5 Pro',
      role: 'Primary – Reasoning Tier',
      status: chaosActive ? 'degraded' : 'healthy',
    },
    {
      name: 'Groq Llama-3.1-8B-Instant',
      role: 'Failover Provider',
      status: chaosActive ? 'active' : 'standby',
    },
    {
      name: 'Redis Semantic Cache',
      role: 'L1 Cache (in-memory fallback)',
      status: 'healthy',
    },
  ];

  const statusColor: Record<string, string> = {
    healthy: '#34d399',
    standby: '#64748b',
    degraded: '#f87171',
    active: '#fbbf24',
  };

  return (
    <section className="section" aria-label="Provider health">
      <h2 className="section-title">Provider Health &amp; Failover</h2>
      <div className="card">

        {/* Chaos toggle */}
        <div className="chaos-row">
          <div>
            <p className="card-title" style={{ margin: 0 }}>Simulated Provider Outage</p>
            <p className="card-sub" style={{ margin: '4px 0 0' }}>
              Activates the backend's built-in chaos mode — subsequent requests will
              intentionally fail primary providers and trigger Groq failover.{' '}
              <strong style={{ color: '#f87171' }}>
                This controls a real backend flag; no actual outage is triggered automatically.
              </strong>
            </p>
          </div>
          <button
            className={`btn ${chaosActive ? 'btn-danger' : 'btn-outline'}`}
            onClick={handleToggle}
            disabled={toggling}
            aria-pressed={chaosActive}
          >
            {toggling ? '…' : chaosActive ? '🔴 Outage Active – Click to Restore' : '☁ Simulate Outage'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">{error}</div>
        )}

        {/* Provider table */}
        <div className="provider-grid">
          {providers.map((p) => (
            <div key={p.name} className="provider-card">
              <div className="provider-dot" style={{ background: statusColor[p.status] }} aria-hidden="true" />
              <div>
                <p className="provider-name">{p.name}</p>
                <p className="provider-role">{p.role}</p>
              </div>
              <span className="provider-status" style={{ color: statusColor[p.status] }}>
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
