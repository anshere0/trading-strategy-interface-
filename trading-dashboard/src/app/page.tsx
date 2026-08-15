'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────

type MarketItem = {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  perChange: number;
  volume: number;
  rvol: string;
  source: string;
};

type PreOpenItem = {
  symbol: string;
  previousClose: number;
  iep: number;
  pChange: number;
  ohol: string;
  nearestLevel: {
    name: string;
    value: number;
    position: 'ABOVE' | 'BELOW';
    distancePercent: number;
  } | null;
};

type MarketData = {
  timestamp: string;
  losers: MarketItem[];
  gainers: MarketItem[];
  preOpenGainers: PreOpenItem[];
  preOpenLosers: PreOpenItem[];
  totalPreOpenContracts: number;
  intradayGainers: MarketItem[];
  intradayLosers: MarketItem[];
};

// ─── Helpers ─────────────────────────────────────────

function fmtPrice(n: number) {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss} IST`;
}

// ─── Component ───────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Controls
  const [rows, setRows] = useState<number>(5);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Thresholds (kept from previous implementation)
  const [threshold] = useState<number>(1.25);
  const [maxThreshold] = useState<number>(5.0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch ─────────────────────────────────────────

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/market?threshold=${threshold}&maxThreshold=${maxThreshold}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as MarketData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [threshold, maxThreshold]);

  // ─── Auto-refresh ──────────────────────────────────

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
    // Clear previous intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (autoRefreshSec > 0) {
      setCountdown(autoRefreshSec);

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return autoRefreshSec;
          return prev - 1;
        });
      }, 1000);

      intervalRef.current = setInterval(() => {
        fetchMarketData();
        setCountdown(autoRefreshSec);
      }, autoRefreshSec * 1000);
    } else {
      setCountdown(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefreshSec, fetchMarketData]);

  // ─── Filtering ─────────────────────────────────────

  const filterBySearch = <T extends { symbol: string }>(items: T[] | undefined): T[] => {
    if (!items) return [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toUpperCase().trim();
    return items.filter(item => item.symbol.toUpperCase().includes(q));
  };

  const sliceRows = <T,>(items: T[]): T[] => {
    if (rows === 0) return items; // "All"
    return items.slice(0, rows);
  };

  const preOpenGainers = sliceRows(filterBySearch(data?.preOpenGainers));
  const preOpenLosers = sliceRows(filterBySearch(data?.preOpenLosers));
  const intradayGainers = sliceRows(filterBySearch(data?.intradayGainers));
  const intradayLosers = sliceRows(filterBySearch(data?.intradayLosers));

  // Stats
  const matchedGainers = data?.intradayGainers?.length ?? 0;
  const matchedLosers = data?.intradayLosers?.length ?? 0;
  const totalContracts = data?.totalPreOpenContracts ?? 0;

  // ─── Render ────────────────────────────────────────

  return (
    <main className="min-h-screen p-4 lg:p-8 animate-fade-in text-sm font-medium">

      {/* ───── HEADER ───── */}
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">NSE Intraday Scanner</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Live movers + F&O pre-open in one dashboard</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className="live-dot" />
          <span>Live server data</span>
        </div>
      </header>

      {/* ───── ERROR ───── */}
      {error && (
        <div className="p-4 mb-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* ───── CONTROLS ROW ───── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-secondary)] text-xs font-semibold">Rows</label>
          <select
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
            className="control-select w-20"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={0}>All</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-secondary)] text-xs font-semibold">Auto refresh</label>
          <select
            value={autoRefreshSec}
            onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
            className="control-select w-24"
          >
            <option value={0}>Off</option>
            <option value={5}>5 sec</option>
            <option value={10}>10 sec</option>
            <option value={30}>30 sec</option>
            <option value={60}>60 sec</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[var(--text-secondary)] text-xs font-semibold">Find symbol</label>
          <input
            type="text"
            placeholder="e.g. RELIANCE"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="control-input w-full"
          />
        </div>

        <div className="flex flex-col gap-1 self-end">
          <button
            onClick={() => { fetchMarketData(); setCountdown(autoRefreshSec); }}
            disabled={loading}
            className="btn-refresh"
          >
            {loading ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>

      {/* ───── STATS CARDS ───── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <span className="stat-title">Matched gainers</span>
          <span className="stat-value text-[var(--accent-green)]">{matchedGainers}</span>
          <span className="stat-label">Open − Low &lt; ₹0.25</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Matched losers</span>
          <span className="stat-value text-[var(--accent-red)]">{matchedLosers}</span>
          <span className="stat-label">High − Open &lt; ₹0.25</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">F&O pre-open</span>
          <span className="stat-value text-[var(--accent-blue)]">{totalContracts}</span>
          <span className="stat-label">Total contracts received</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Last server update</span>
          <span className="text-base font-bold leading-snug" style={{ fontSize: '1.05rem' }}>
            {data?.timestamp ? fmtTimestamp(data.timestamp) : '—'}
          </span>
          <span className="stat-label">
            {autoRefreshSec > 0 ? `Next refresh in ${countdown}s` : 'Auto-refresh off'}
          </span>
        </div>
      </div>

      {/* ───── F&O PRE-OPEN SECTION ───── */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="section-title">F&O Pre-open</h2>
          <p className="section-subtitle">Strongest positive and negative indicative moves before market open.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gainers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Pre-open Gainers</h3>
              <span className="badge-green">TOP ↑</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="py-2.5 px-4 font-semibold uppercase">Symbol</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Prev Close</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">IEP</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenGainers.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold">{item.symbol}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{fmtPrice(item.previousClose)}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtPrice(item.iep)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--accent-green)]">+{item.pChange?.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!preOpenGainers.length && !loading && (
                    <tr><td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Losers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Pre-open Losers</h3>
              <span className="badge-red">TOP ↓</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="py-2.5 px-4 font-semibold uppercase">Symbol</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Prev Close</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">IEP</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenLosers.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold">{item.symbol}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{fmtPrice(item.previousClose)}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtPrice(item.iep)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--accent-red)]">{item.pChange?.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!preOpenLosers.length && !loading && (
                    <tr><td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───── INTRADAY SCANNER SECTION ───── */}
      <section className="mb-4">
        <div className="mb-4">
          <h2 className="section-title">Intraday Scanner</h2>
          <p className="section-subtitle">Combined FOSec + NIFTY + BANKNIFTY response, de-duplicated by symbol.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Intraday Gainers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Gainers</h3>
              <span className="badge-green">Low = Open</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="py-2.5 px-4 font-semibold uppercase">Symbol</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Change</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Open</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Low</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">LTP</th>
                  </tr>
                </thead>
                <tbody>
                  {intradayGainers.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold">
                        {item.symbol}
                        <span className="source-badge">{item.source}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--accent-green)]">+{item.perChange?.toFixed(2)}%</td>
                      <td className="py-3 px-4 text-right">{fmtPrice(item.open)}</td>
                      <td className="py-3 px-4 text-right">{fmtPrice(item.low)}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtPrice(item.ltp)}</td>
                    </tr>
                  ))}
                  {!intradayGainers.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">No matched gainers (Open − Low &lt; ₹0.25)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intraday Losers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Losers</h3>
              <span className="badge-red">High = Open</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="py-2.5 px-4 font-semibold uppercase">Symbol</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Change</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">Open</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">High</th>
                    <th className="py-2.5 px-4 font-semibold text-right uppercase">LTP</th>
                  </tr>
                </thead>
                <tbody>
                  {intradayLosers.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold">
                        {item.symbol}
                        <span className="source-badge">{item.source}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--accent-red)]">{item.perChange?.toFixed(2)}%</td>
                      <td className="py-3 px-4 text-right">{fmtPrice(item.open)}</td>
                      <td className="py-3 px-4 text-right">{fmtPrice(item.high)}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtPrice(item.ltp)}</td>
                    </tr>
                  ))}
                  {!intradayLosers.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">No matched losers (High − Open &lt; ₹0.25)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="app-footer">
        <span>Data source: NSE public website endpoints via your server.</span>
        <span>For trading decisions, verify prices with your broker/exchange terminal.</span>
      </footer>

    </main>
  );
}
