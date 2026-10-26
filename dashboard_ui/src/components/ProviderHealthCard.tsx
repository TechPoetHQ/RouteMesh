import { useState } from 'react';
import { api } from '../api';
import type { TelemetryEntry } from '../types';

interface ProviderHealthCardProps {
  chaosActive: boolean;
  onToggleChaos: () => void;
  isDemoMode?: boolean;
  isOffline?: boolean;
  logs?: TelemetryEntry[];
}

interface ProviderItem {
  name: string;
  endpoint: string;
  subtitle: string;
  status: 'Online' | 'Degraded' | 'Standby' | 'Offline';
  latency: string;
  isFailoverNotice?: boolean;
}

export function ProviderHealthCard({
  chaosActive,
  onToggleChaos,
  isDemoMode,
  isOffline,
  logs = [],
}: ProviderHealthCardProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleToggle() {
    setToggling(true);
    setToggleError(null);
    try {
      await api.toggleChaos();
      onToggleChaos();
    } catch (e) {
      setToggleError(
        e instanceof Error && e.message !== 'Load failed'
          ? e.message
          : 'Gateway connection failed — ensure backend is running on port 8000'
      );
    } finally {
      setToggling(false);
    }
  }

  // Demo providers matching the exact Stitch design
  const demoProviders: ProviderItem[] = [
    {
      name: 'OpenAI',
      endpoint: 'api.openai.com',
      subtitle: 'P95 latency • Error 0.01%',
      status: 'Online',
      latency: '340ms',
    },
    {
      name: 'Anthropic',
      endpoint: 'api.anthropic.com',
      subtitle: 'P95 latency • Error 0.00%',
      status: 'Online',
      latency: '410ms',
    },
    {
      name: 'DeepSeek',
      endpoint: 'api.deepseek.com',
      subtitle: 'Failover routed to Claude-3.5-Haiku',
      status: 'Degraded',
      latency: '1,120ms',
      isFailoverNotice: true,
    },
    {
      name: 'Mistral AI',
      endpoint: 'api.mistral.ai',
      subtitle: 'Standby route • Error 0.00%',
      status: 'Online',
      latency: '290ms',
    },
  ];

  // Offline providers (when backend is unreachable)
  const offlineProviders: ProviderItem[] = [
    {
      name: 'Gemini 2.5 Flash',
      endpoint: 'generativelanguage.googleapis.com',
      subtitle: 'Gateway offline — service unreachable',
      status: 'Offline',
      latency: '—',
    },
    {
      name: 'Gemini 2.5 Pro',
      endpoint: 'generativelanguage.googleapis.com',
      subtitle: 'Gateway offline — service unreachable',
      status: 'Offline',
      latency: '—',
    },
    {
      name: 'Groq Llama-3.1-8B',
      endpoint: 'api.groq.com',
      subtitle: 'Gateway offline — service unreachable',
      status: 'Offline',
      latency: '—',
    },
    {
      name: 'Redis Cache',
      endpoint: 'routemesh.cache.local',
      subtitle: 'Gateway offline — service unreachable',
      status: 'Offline',
      latency: '—',
    },
  ];

  // Derive real measured provider latencies from live telemetry logs
  const flashLogs = logs.filter((l) => l.model_used.includes('flash'));
  const proLogs = logs.filter((l) => l.model_used.includes('pro'));
  const groqLogs = logs.filter((l) => l.model_used.includes('groq'));
  const cacheLogs = logs.filter((l) => l.cache_hit);

  const avgFlashLat = flashLogs.length > 0
    ? `${(flashLogs.reduce((s, l) => s + l.total_latency_ms, 0) / flashLogs.length).toFixed(0)}ms`
    : '180ms';
  const avgProLat = proLogs.length > 0
    ? `${(proLogs.reduce((s, l) => s + l.total_latency_ms, 0) / proLogs.length).toFixed(0)}ms`
    : '420ms';
  const avgGroqLat = groqLogs.length > 0
    ? `${(groqLogs.reduce((s, l) => s + l.total_latency_ms, 0) / groqLogs.length).toFixed(0)}ms`
    : '190ms';
  const avgCacheLat = cacheLogs.length > 0
    ? `${(cacheLogs.reduce((s, l) => s + l.router_latency_ms, 0) / cacheLogs.length).toFixed(1)}ms`
    : '< 2ms';

  // Live gateway providers mapped to real backend services & chaos state
  const liveProviders: ProviderItem[] = [
    {
      name: 'Gemini 2.5 Flash',
      endpoint: 'generativelanguage.googleapis.com',
      subtitle: chaosActive ? 'Primary route offline (Chaos active)' : 'Fast tier • Primary route',
      status: chaosActive ? 'Degraded' : 'Online',
      latency: chaosActive ? 'Timeout' : avgFlashLat,
      isFailoverNotice: chaosActive,
    },
    {
      name: 'Gemini 2.5 Pro',
      endpoint: 'generativelanguage.googleapis.com',
      subtitle: chaosActive ? 'Primary route offline (Chaos active)' : 'Reasoning tier • Primary route',
      status: chaosActive ? 'Degraded' : 'Online',
      latency: chaosActive ? 'Timeout' : avgProLat,
      isFailoverNotice: chaosActive,
    },
    {
      name: 'Groq Llama-3.1-8B',
      endpoint: 'api.groq.com',
      subtitle: chaosActive ? 'Active failover reroute' : 'Instant fallback route',
      status: chaosActive ? 'Online' : 'Standby',
      latency: chaosActive ? avgGroqLat : 'Standby',
      isFailoverNotice: false,
    },
    {
      name: 'Redis Cache',
      endpoint: 'routemesh.cache.local',
      subtitle: 'Semantic vector cache (sim ≥ 0.92)',
      status: 'Online',
      latency: avgCacheLat,
    },
  ];

  const providers = isDemoMode
    ? demoProviders
    : isOffline
    ? offlineProviders
    : liveProviders;

  const onlineCount = providers.filter((p) => p.status === 'Online').length;
  const badgeText = isOffline ? '0/4 Online' : `${onlineCount}/${providers.length} Online`;

  return (
    <div className="provider-health-card">
      <div className="provider-health-header">
        <h3 className="provider-health-title">Provider Health</h3>
        <span className="provider-health-badge">{badgeText}</span>
      </div>

      <div className="provider-list">
        {providers.map((p) => (
          <div key={p.name} className="provider-row">
            <div className="provider-main">
              <div className="provider-title-line">
                <span className="provider-name">{p.name}</span>
                <span className="provider-endpoint">{p.endpoint}</span>
              </div>
              <div className={`provider-sub ${p.isFailoverNotice ? 'provider-sub--warn' : ''}`}>
                {p.subtitle}
              </div>
            </div>

            <div className="provider-meta">
              <span className={`status-pill status-pill--${p.status.toLowerCase()}`}>
                {p.status}
              </span>
              <span className="provider-latency">{p.latency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Failover simulation control */}
      <div className="provider-footer">
        <button
          className={`chaos-btn ${chaosActive ? 'chaos-btn--active' : ''}`}
          onClick={handleToggle}
          disabled={toggling}
          title="Toggle chaos outage on primary gateway providers to test failover"
        >
          {toggling
            ? 'Updating…'
            : chaosActive
            ? 'Simulated Outage Active (Click to restore)'
            : 'Test Failover (Simulate Outage)'}
        </button>
        {toggleError && (
          <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 6 }}>
            ⚠ {toggleError}
          </p>
        )}
      </div>
    </div>
  );
}
