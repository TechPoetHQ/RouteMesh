import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Check,
  CircleHelp,
  Clock3,
  Coins,
  Database,
  LoaderCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react'

type Telemetry = {
  request_id: string
  timestamp: string
  prompt_preview: string
  cache_hit: boolean
  similarity_score: number
  router_latency_ms: number
  tier: string
  model_used: string
  failover_triggered: boolean
  total_latency_ms: number
  estimated_cost_usd: number
  baseline_cost_usd: number
}

type Stats = {
  total_requests: number
  cache_hits: number
  cache_hit_rate_pct: number
  failovers_handled: number
  actual_spend_usd: number
  baseline_spend_usd: number
  total_saved_usd: number
  avg_latency_ms: number
  chaos_outage_active: boolean
  recent_logs: Telemetry[]
}

type ChatResponse = {
  choices: Array<{ message: { content: string } }>
  routemesh_meta: Telemetry
}

const emptyStats: Stats = {
  total_requests: 0,
  cache_hits: 0,
  cache_hit_rate_pct: 0,
  failovers_handled: 0,
  actual_spend_usd: 0,
  baseline_spend_usd: 0,
  total_saved_usd: 0,
  avg_latency_ms: 0,
  chaos_outage_active: false,
  recent_logs: [],
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`
}

function App() {
  const [stats, setStats] = useState(emptyStats)
  const [answer, setAnswer] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [connected, setConnected] = useState(false)

  const refreshStats = useCallback(async () => {
    try {
      const nextStats = await request<Stats>('/api/stats')
      setStats(nextStats)
      setConnected(true)
      setError('')
    } catch (reason) {
      setConnected(false)
      setError(reason instanceof Error ? reason.message : 'Could not load dashboard data.')
    }
  }, [])

  useEffect(() => {
    void refreshStats()
    const interval = window.setInterval(() => void refreshStats(), 5000)
    return () => window.clearInterval(interval)
  }, [refreshStats])

  async function runAction(name: string, action: () => Promise<void>) {
    setBusy(name)
    setError('')
    try {
      await action()
      await refreshStats()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action failed.')
    } finally {
      setBusy('')
    }
  }

  async function sendPrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) return
    await runAction('chat', async () => {
      const result = await request<ChatResponse>('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'routemesh-auto',
          messages: [{ role: 'user', content: trimmedPrompt }],
        }),
      })
      setAnswer(result.choices[0]?.message.content ?? 'The provider returned an empty response.')
      setPrompt('')
    })
  }

  const savingsPercent = stats.baseline_spend_usd
    ? Math.max(0, Math.round((stats.total_saved_usd / stats.baseline_spend_usd) * 100))
    : 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="RouteMesh home">
          <span className="brand-mark"><Activity size={20} /></span>
          <span>route<span className="brand-accent">mesh</span></span>
        </a>
        <div className="topbar-right">
          <span className={`connection ${connected ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            {connected ? 'Gateway connected' : 'Gateway unavailable'}
          </span>
          <button className="icon-button" onClick={() => void refreshStats()} aria-label="Refresh dashboard">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">CONTROL PLANE</p>
          <h1>Routing overview</h1>
          <p className="subheading">Monitor requests, cache performance, and provider resilience.</p>
        </div>
        <button
          className={`button ${stats.chaos_outage_active ? 'button-danger' : 'button-secondary'}`}
          disabled={busy !== ''}
          onClick={() => void runAction('chaos', async () => {
            await request('/api/chaos/toggle', { method: 'POST' })
          })}
        >
          <ShieldAlert size={16} />
          {stats.chaos_outage_active ? 'Disable failover test' : 'Test provider failover'}
        </button>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <CircleHelp size={17} />
          <span>{error}</span>
        </div>
      )}

      <section className="metrics-grid" aria-label="Routing metrics">
        <MetricCard icon={<MessageSquareText />} label="Total requests" value={stats.total_requests.toLocaleString()} detail="Since last cache clear" />
        <MetricCard icon={<Database />} label="Cache hit rate" value={`${stats.cache_hit_rate_pct.toFixed(1)}%`} detail={`${stats.cache_hits} requests served from cache`} accent="green" />
        <MetricCard icon={<Clock3 />} label="Average latency" value={`${stats.avg_latency_ms.toFixed(1)} ms`} detail="End-to-end response time" accent="blue" />
        <MetricCard icon={<Coins />} label="Cost saved" value={formatUsd(stats.total_saved_usd)} detail={`${savingsPercent}% below baseline`} accent="purple" />
      </section>

      <section className="content-grid">
        <div className="panel chat-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-icon"><Bot size={18} /></span>
              <div><h2>Try RouteMesh</h2><p>Send a prompt through the live router</p></div>
            </div>
            <span className="pill">AUTO ROUTING</span>
          </div>
          <form className="prompt-form" onSubmit={(event) => void sendPrompt(event)}>
            <label className="sr-only" htmlFor="prompt">Your prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask a question to test routing, caching, and provider failover..."
              rows={3}
            />
            <div className="prompt-footer">
              <span><Zap size={14} /> Routed automatically by complexity</span>
              <button className="button button-primary" type="submit" disabled={!prompt.trim() || busy !== ''}>
                {busy === 'chat' ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}
                Send prompt
              </button>
            </div>
          </form>
          {answer && <div className="answer-box"><p className="answer-label">ROUTEMESH RESPONSE</p><p>{answer}</p></div>}
        </div>

        <div className="panel spend-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-icon purple"><Coins size={18} /></span>
              <div><h2>Spend efficiency</h2><p>Estimated provider cost</p></div>
            </div>
          </div>
          <div className="spend-summary">
            <div><span>Actual spend</span><strong>{formatUsd(stats.actual_spend_usd)}</strong></div>
            <div><span>Baseline spend</span><strong className="muted-value">{formatUsd(stats.baseline_spend_usd)}</strong></div>
          </div>
          <div className="spend-bar"><span style={{ width: `${stats.baseline_spend_usd ? Math.min(100, (stats.actual_spend_usd / stats.baseline_spend_usd) * 100) : 0}%` }} /></div>
          <div className="spend-foot"><span><ArrowDownRight size={15} /> {savingsPercent}% cost reduction</span><span>{stats.failovers_handled} failovers</span></div>
          <div className="spend-note"><ArrowUpRight size={14} /> Cache hits and routing reduce estimated spend.</div>
        </div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading activity-heading">
          <div className="panel-title">
            <span className="panel-icon blue"><Activity size={18} /></span>
            <div><h2>Recent activity</h2><p>Latest requests processed by the gateway</p></div>
          </div>
          <div className="activity-actions">
            <button
              className="button button-secondary button-small"
              disabled={busy !== ''}
              onClick={() => void runAction('benchmark', async () => {
                await request('/api/benchmark/run', { method: 'POST' })
              })}
            >
              {busy === 'benchmark' ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />}
              Run benchmark
            </button>
            <button
              className="button button-quiet button-small"
              disabled={busy !== ''}
              onClick={() => void runAction('clear', async () => {
                await request('/api/cache/clear', { method: 'POST' })
              })}
            >
              {busy === 'clear' ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
              Clear cache
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Request</th><th>Route</th><th>Result</th><th>Latency</th><th>Cost</th><th>Time</th></tr></thead>
            <tbody>
              {stats.recent_logs.length === 0 ? (
                <tr><td className="empty-state" colSpan={6}>No requests yet. Send a prompt to see activity here.</td></tr>
              ) : stats.recent_logs.map((log) => (
                <tr key={log.request_id}>
                  <td className="request-cell"><strong>{log.prompt_preview || 'Prompt'}</strong><span>{log.request_id}</span></td>
                  <td><span className={`tier-tag ${log.tier === 'reasoning' ? 'reasoning' : ''}`}>{log.tier}</span><span className="model-name">{log.model_used}</span></td>
                  <td>{log.cache_hit ? <span className="result-tag cached"><Check size={12} /> Cache hit</span> : log.failover_triggered ? <span className="result-tag failover">Failover</span> : <span className="result-tag routed">Routed</span>}</td>
                  <td>{log.total_latency_ms.toFixed(0)} ms</td>
                  <td>{formatUsd(log.estimated_cost_usd)}</td>
                  <td className="time-cell">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <footer className="footer"><span>RouteMesh Gateway</span><span>Live metrics refresh every 5 seconds</span></footer>
    </main>
  )
}

function MetricCard({ icon, label, value, detail, accent = '' }: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  accent?: string
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  )
}

export default App
