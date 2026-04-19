'use client'
import { useState, useEffect, useRef } from 'react'

type ScanStatus = 'idle' | 'submitting' | 'queued' | 'running' | 'complete' | 'failed'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Finding {
  id: string; module: string; title: string; description: string; severity: Severity
  recommendation: string; dpdp_section: string | null; dpdp_fine_range: string | null; dpdp_implication: string | null
}

interface ScanResult {
  id: string; target_domain: string; status: string; score: number | null
  findings: Finding[]; report: { summary: string; model: string } | null
  duration_ms: number | null; error_message: string | null
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string; icon: string }> = {
  critical: { color: '#ef4444', bg: '#ef444415', label: 'CRITICAL', icon: '🔴' },
  high:     { color: '#f97316', bg: '#f9731615', label: 'HIGH', icon: '🟠' },
  medium:   { color: '#eab308', bg: '#eab30815', label: 'MEDIUM', icon: '🟡' },
  low:      { color: '#22c55e', bg: '#22c55e15', label: 'LOW', icon: '🟢' },
  info:     { color: '#6366f1', bg: '#6366f115', label: 'INFO', icon: '🔵' },
}

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [scanId, setScanId] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setStatus('submitting')
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/v1/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      let data: any = {}
      try { data = await res.json() } catch { /* non-JSON body */ }
      if (!res.ok) {
        setError(`Error ${res.status}: ${data.message || 'Failed to submit scan'}`)
        setStatus('idle')
        return
      }

      setScanId(data.scan_id)
      setStatus('queued')
      startPolling(data.scan_id)
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Could not reach server'}`)
      setStatus('idle')
    }
  }

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/scans/${id}/status`)
        const data = await res.json()
        if (data.status === 'running') setStatus('running')
        if (data.status === 'complete' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          setStatus(data.status)
          // Fetch full results
          const fullRes = await fetch(`/api/v1/scans/${id}`)
          const fullData = await fullRes.json()
          setResult(fullData)
        }
      } catch { /* keep polling */ }
    }, 3000)
  }

  function getScoreColor(score: number) {
    if (score >= 80) return '#22c55e'
    if (score >= 50) return '#eab308'
    return '#ef4444'
  }

  function handleReset() {
    setUrl(''); setStatus('idle'); setScanId(null); setResult(null); setError(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const isScanning = status === 'submitting' || status === 'queued' || status === 'running'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: result ? 'flex-start' : 'center', padding: '40px 20px', transition: 'all 0.5s ease' }}>

      {/* Logo */}
      <div onClick={handleReset} style={{ cursor: 'pointer', textAlign: 'center', marginBottom: result ? 24 : 40, transition: 'margin 0.5s ease' }}>
        <h1 style={{ fontSize: result ? 28 : 56, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-2px', transition: 'font-size 0.5s ease' }}>
          Sagittarius
        </h1>
        {!result && (
          <p style={{ color: '#737373', fontSize: 16, marginTop: 8, fontWeight: 400 }}>
            Free website security scanner — powered by 10 security APIs
          </p>
        )}
      </div>

      {/* Search Box */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 680, marginBottom: 20 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #262626', borderRadius: 28, padding: '4px 4px 4px 20px', transition: 'border-color 0.2s', ...(isScanning ? { borderColor: '#6366f1', boxShadow: '0 0 20px #6366f120' } : {}) }}>
          <span style={{ color: '#737373', fontSize: 18, marginRight: 12, flexShrink: 0 }}>🔍</span>
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Enter any website URL... e.g. example.com"
            disabled={isScanning}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fafafa', fontSize: 16, fontFamily: 'inherit', padding: '12px 0' }}
          />
          <button
            type="submit"
            disabled={isScanning || !url.trim()}
            style={{ background: isScanning ? '#4f46e5' : '#6366f1', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 28px', fontSize: 14, fontWeight: 600, cursor: isScanning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', opacity: !url.trim() && !isScanning ? 0.5 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isScanning && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff4', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
            {status === 'submitting' ? 'Submitting...' : isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{ background: '#ef444415', border: '1px solid #ef444430', borderRadius: 12, padding: '12px 20px', maxWidth: 680, width: '100%', color: '#fca5a5', fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Scanning Status */}
      {isScanning && (
        <div style={{ textAlign: 'center', color: '#737373', fontSize: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: 'pulse 1.5s infinite' }} />
            <span>{status === 'queued' ? 'Scan queued — waiting for worker...' : 'Scanning across 10 security APIs...'}</span>
          </div>
          <p style={{ fontSize: 12, color: '#525252' }}>This usually takes 1-3 minutes</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ width: '100%', maxWidth: 800, animation: 'fadeIn 0.5s ease' }}>

          {/* Score Card */}
          <div style={{ background: '#111', border: '1px solid #262626', borderRadius: 16, padding: 32, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" stroke="#262626" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="42" stroke={getScoreColor(result.score ?? 0)} strokeWidth="8" fill="none" strokeDasharray={`${(result.score ?? 0) * 2.64} 264`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: getScoreColor(result.score ?? 0), fontFamily: "'JetBrains Mono', monospace" }}>{result.score ?? '—'}</span>
                <span style={{ fontSize: 10, color: '#737373' }}>/100</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{result.target_domain}</h2>
              <p style={{ color: '#737373', fontSize: 13 }}>
                Scan completed in {result.duration_ms ? (result.duration_ms / 1000).toFixed(1) + 's' : '—'}
                {' · '}{result.findings.length} findings
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map(sev => {
                  const count = result.findings.filter(f => f.severity === sev).length
                  if (count === 0) return null
                  const cfg = SEVERITY_CONFIG[sev]
                  return <span key={sev} style={{ background: cfg.bg, color: cfg.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{cfg.icon} {count} {cfg.label}</span>
                })}
              </div>
            </div>
          </div>

          {/* AI Report */}
          {result.report && (
            <div style={{ background: 'linear-gradient(135deg, #1e1b4b15, #581c8715)', border: '1px solid #6366f130', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✨ AI Security Report
                <span style={{ fontSize: 11, color: '#737373', fontWeight: 400 }}>by {result.report.model}</span>
              </h3>
              <div style={{ color: '#d4d4d4', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {result.report.summary}
              </div>
            </div>
          )}

          {/* DPDP Violations */}
          {result.findings.some(f => f.dpdp_section) && (
            <div style={{ background: '#ef444410', border: '1px solid #ef444425', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#fca5a5' }}>
                ⚖️ DPDP Act 2023 Violations
              </h3>
              {result.findings.filter(f => f.dpdp_section).map((f, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < result.findings.filter(x => x.dpdp_section).length - 1 ? '1px solid #ef444415' : 'none' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 4 }}>{f.dpdp_section} — Fine: {f.dpdp_fine_range}</div>
                  <div style={{ color: '#a3a3a3', fontSize: 12 }}>{f.dpdp_implication}</div>
                </div>
              ))}
            </div>
          )}

          {/* Findings */}
          <div style={{ background: '#111', border: '1px solid #262626', borderRadius: 16, overflow: 'hidden' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, padding: '16px 24px', borderBottom: '1px solid #262626', color: '#a3a3a3' }}>
              All Findings ({result.findings.length})
            </h3>
            {result.findings.map((f, i) => {
              const cfg = SEVERITY_CONFIG[f.severity]
              return (
                <div key={f.id || i} style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{cfg.label}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.title}</div>
                    <div style={{ color: '#a3a3a3', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{f.description}</div>
                    <div style={{ color: '#6366f1', fontSize: 12, fontStyle: 'italic' }}>💡 {f.recommendation}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scan Again */}
          <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 40 }}>
            <button onClick={handleReset} style={{ background: '#1a1a1a', border: '1px solid #262626', color: '#fafafa', padding: '12px 32px', borderRadius: 28, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Scan Another Website
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {!result && !isScanning && (
        <div style={{ position: 'fixed', bottom: 24, textAlign: 'center', color: '#525252', fontSize: 12 }}>
          <p>Scans SSL, security headers, malware, breaches, DNS, email security & more</p>
          <p style={{ marginTop: 4 }}>Powered by SSL Labs · VirusTotal · Google Safe Browsing · HIBP · and 6 more APIs</p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
