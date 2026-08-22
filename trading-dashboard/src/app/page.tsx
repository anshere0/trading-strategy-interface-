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
  source: string;
};

type PreOpenItem = {
  symbol: string;
  previousClose: number;
  iep: number;
  pChange: number;
};

type PivotSignal = {
  symbol: string;
  preOpenChange: number;
  preOpenIep: number;
  previousClose: number;
  signalTime: string;
  price: number;
  setupLevelName: string;
  setupLevel: number;
  setup: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  volumeMA: number;
  previousVolume: number;
  session: string;
  finalConfirmed: boolean;
};

type MarketData = {
  ok: boolean;
  timestamp: string;
  updatedLabel: string;
  serverTime: string;
  serverToday: string;
  marketOpen: boolean;
  preOpenPhase: boolean;
  marketPhase: string;
  counts: {
    gainers: number;
    losers: number;
    preopen: number;
  };
  preOpenGainers: PreOpenItem[];
  preOpenLosers: PreOpenItem[];
  totalPreOpenContracts: number;
  intradayGainers: MarketItem[];
  intradayLosers: MarketItem[];
  gainers: MarketItem[];
  losers: MarketItem[];
  pivotSignals: {
    buy: PivotSignal[];
    sell: PivotSignal[];
    confirmedBuy: PivotSignal[];
    confirmedSell: PivotSignal[];
    counts: {
      buy: number;
      sell: number;
      confirmedBuy: number;
      confirmedSell: number;
      setups: number;
      universe: number;
    };
    session: string;
    sessionLabel: string;
    rule: string;
    dataMode: string;
    stale: boolean;
  };
  twsSignals?: {
    long: {
      symbol: string;
      ltp: number;
      status: 'LONG ACTIVE' | 'SHORT ACTIVE' | 'PDH BROKEN' | 'PDL BROKEN';
      trigger: string;
      entryPx?: number;
      stopPx?: number;
      tgt1?: number;
      tgt2?: number;
      time: string;
    }[];
    short: {
      symbol: string;
      ltp: number;
      status: 'LONG ACTIVE' | 'SHORT ACTIVE' | 'PDH BROKEN' | 'PDL BROKEN';
      trigger: string;
      entryPx?: number;
      stopPx?: number;
      tgt1?: number;
      tgt2?: number;
      time: string;
    }[];
  };
  preOpenSessionLabel: string;
  moversSessionLabel: string;
  stale: boolean;
  message: string;
};

// ─── Helpers ─────────────────────────────────────────

function fmtPrice(n: number) {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(n: number) {
  if (!n) return '—';
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
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

function getSourceClass(source: string) {
  switch (source) {
    case 'BANKNIFTY': return 'banknifty';
    case 'NIFTY': return 'nifty';
    default: return 'fosec';
  }
}

// ─── Component ───────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Controls
  const [rows, setRows] = useState<number>(15);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Clock
  const [clockTime, setClockTime] = useState<string>('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch ─────────────────────────────────────────

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as MarketData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Clock ─────────────────────────────────────────

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60000));
      const hh = String(ist.getHours()).padStart(2, '0');
      const mm = String(ist.getMinutes()).padStart(2, '0');
      const ss = String(ist.getSeconds()).padStart(2, '0');
      setClockTime(`IST ${hh}:${mm}:${ss}`);
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Auto-refresh ──────────────────────────────────

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
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
    if (rows === 0) return items;
    return items.slice(0, rows);
  };

  const preOpenGainers = sliceRows(filterBySearch(data?.preOpenGainers));
  const preOpenLosers = sliceRows(filterBySearch(data?.preOpenLosers));
  const intradayGainers = sliceRows(filterBySearch(data?.intradayGainers));
  const intradayLosers = sliceRows(filterBySearch(data?.intradayLosers));

  // Stats
  const matchedGainers = data?.counts?.gainers ?? 0;
  const matchedLosers = data?.counts?.losers ?? 0;
  const totalContracts = data?.counts?.preopen ?? 0;
  const isMarketClosed = data ? !data.marketOpen : true;

  // ─── Render ────────────────────────────────────────

  return (
    <main className="min-h-screen p-4 lg:p-8 animate-fade-in text-sm font-medium">

      {/* ═══ HEADER ═══ */}
      <header className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">NSE Intraday Scanner</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Live movers + F&O pre-open in one dashboard</p>
        </div>
        <div className="market-status">
          <span className={`status-dot ${data?.marketOpen ? 'open' : ''}`} />
          <span>
            {isMarketClosed ? 'Market closed · last data' : 'Market open · live'}
          </span>
          <span className="time-badge">{clockTime}</span>
        </div>
      </header>

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="p-4 mb-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* ═══ CONTROLS ROW ═══ */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
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
            <option value={25}>25</option>
            <option value={50}>50</option>
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
            <option value={10}>10 sec</option>
            <option value={30}>30 sec</option>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={300}>5 min</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-[600px]">
          <label className="text-[var(--text-secondary)] text-xs font-semibold">Data source</label>
          <select className="control-select-wide" disabled>
            <option>Fyers (live)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[var(--text-secondary)] text-xs font-semibold">Find symbol</label>
          <input
            type="text"
            placeholder="e.g. RELIANCE"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="control-input w-full"
          />
        </div>
      </div>

      {/* Refresh button row */}
      <div className="mb-6">
        <button
          onClick={() => {
            fetchMarketData();
            setCountdown(autoRefreshSec);
          }}
          disabled={loading}
          className="btn-refresh"
        >
          {loading ? 'Refreshing…' : 'Refresh\nnow'}
        </button>
      </div>

      {/* ═══ STATS CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <span className="stat-title">Matched gainers</span>
          <span className="stat-value text-green">{matchedGainers}</span>
          <span className="stat-label">Open − Low &lt; ₹0.25</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Matched losers</span>
          <span className="stat-value text-red">{matchedLosers}</span>
          <span className="stat-label">High − Open &lt; ₹0.25</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">F&O pre-open</span>
          <span className="stat-value text-blue">{totalContracts}</span>
          <span className="stat-label">Total contracts received</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Last server update (IST)</span>
          <span className="text-base font-bold leading-snug" style={{ fontSize: '1.05rem' }}>
            {data?.timestamp ? fmtTimestamp(data.timestamp) : '—'}
          </span>
          <span className="stat-label">
            {autoRefreshSec > 0 ? `Next refresh in ${countdown}s` : 'Auto-refresh off'}
          </span>
        </div>
      </div>

      {/* ═══ MARKET CLOSED BANNER ═══ */}
      {isMarketClosed && data?.message && (
        <div className="market-banner">
          {data.message}
        </div>
      )}

      {/* ═══ F&O PRE-OPEN SECTION ═══ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="section-title">F&O Pre-open</h2>
          {data?.preOpenSessionLabel && (
            <span className="date-badge">{data.preOpenSessionLabel}</span>
          )}
          <p className="section-subtitle">Strongest positive and negative indicative moves before market open.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pre-open Gainers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Pre-open Gainers</h3>
              <span className="badge-green">TOP ↑</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Prev Close</th>
                    <th className="text-right">IEP</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenGainers.map((item) => (
                    <tr key={item.symbol}>
                      <td className="font-bold">{item.symbol}</td>
                      <td className="text-right text-muted">{fmtPrice(item.previousClose)}</td>
                      <td className="text-right font-medium">{fmtPrice(item.iep)}</td>
                      <td className="text-right font-bold text-green">+{item.pChange?.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!preOpenGainers.length && !loading && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pre-open Losers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Pre-open Losers</h3>
              <span className="badge-red">TOP ↓</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Prev Close</th>
                    <th className="text-right">IEP</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenLosers.map((item) => (
                    <tr key={item.symbol}>
                      <td className="font-bold">{item.symbol}</td>
                      <td className="text-right text-muted">{fmtPrice(item.previousClose)}</td>
                      <td className="text-right font-medium">{fmtPrice(item.iep)}</td>
                      <td className="text-right font-bold text-red">{item.pChange?.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {!preOpenLosers.length && !loading && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ F&O PRE-OPEN PIVOT SIGNALS ═══ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="section-title">F&O Pre-open Pivot Signals</h2>
          <p className="section-subtitle mt-2" style={{ maxWidth: '60%' }}>
            {data?.pivotSignals?.rule || 'Only the top 3 F&O pre-open gainers + top 3 losers are scanned (maximum 6 securities). 09:15 Open may qualify near any Traditional level S5–S1 / P / R1–R5; 09:16–09:20 watches all levels. The first price + Volume MA20 + previous-Volume match creates the BUY/SELL arrow. FINAL confirmation uses only the immediate next 1-minute candle.'}
          </p>
        </div>

        {/* Pivot Status Banner */}
        {data?.pivotSignals && (
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1" />
            <div className="pivot-status-banner lg:max-w-[55%]">
              <span className="status-dot-red" />
              <div>
                <div style={{ fontWeight: 600 }}>
                  LAST AVAILABLE · {data.pivotSignals.sessionLabel}
                </div>
                <div style={{ marginTop: 2 }}>
                  {isMarketClosed
                    ? `Market closed / no current session — showing the last available signal day ${data.pivotSignals.session}.`
                    : 'Session in progress.'}
                </div>
                <div style={{ marginTop: 2 }}>
                  Scanned {data.pivotSignals.counts.universe} visible F&O pre-open securities; {data.pivotSignals.counts.setups} had a 09:15 setup; {data.pivotSignals.counts.confirmedBuy} FINAL BUY and {data.pivotSignals.counts.confirmedSell} FINAL SELL.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* BUY Signals */}
          <div className="signal-panel">
            <div className="signal-header">
              <h3>BUY Signals</h3>
              <span className="signal-count buy-count">
                {data?.pivotSignals?.counts.buy ?? 0} BUY ↑
              </span>
            </div>
            <div className="signal-body">
              {data?.pivotSignals?.buy?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Pre-open</th>
                      <th>Time</th>
                      <th>Price</th>
                      <th>Level</th>
                      <th>Volume</th>
                      <th>Vol MA20</th>
                      <th>Prev Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pivotSignals.buy.map((sig) => (
                      <tr key={sig.symbol}>
                        <td>
                          <div className="font-bold">
                            <span className="signal-arrow buy">↑</span>
                            {sig.symbol}
                          </div>
                          <div className="signal-symbol-info">
                            {sig.session} · {sig.setup}
                          </div>
                        </td>
                        <td className="text-green font-bold">+{sig.preOpenChange.toFixed(2)}%</td>
                        <td className="text-cyan font-bold">{sig.signalTime}</td>
                        <td className="text-yellow font-bold">{fmtPrice(sig.price)}</td>
                        <td className="font-bold">{sig.setupLevelName} {fmtPrice(sig.setupLevel)}</td>
                        <td>{fmtVol(sig.volume)}</td>
                        <td>{fmtVol(sig.volumeMA)}</td>
                        <td>{fmtVol(sig.previousVolume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No BUY arrow signal yet.</div>
              )}
            </div>
          </div>

          {/* SELL Signals */}
          <div className="signal-panel">
            <div className="signal-header">
              <h3>SELL Signals</h3>
              <span className="signal-count sell-count">
                {data?.pivotSignals?.counts.sell ?? 0} SELL ↓
              </span>
            </div>
            <div className="signal-body">
              {data?.pivotSignals?.sell?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Pre-open</th>
                      <th>Time</th>
                      <th>Price</th>
                      <th>Level</th>
                      <th>Volume</th>
                      <th>Vol MA20</th>
                      <th>Prev Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pivotSignals.sell.map((sig) => (
                      <tr key={sig.symbol}>
                        <td>
                          <div className="font-bold">
                            <span className="signal-arrow sell">↓</span>
                            {sig.symbol}
                          </div>
                          <div className="signal-symbol-info">
                            {sig.session} · {sig.setup}
                          </div>
                        </td>
                        <td className="text-green font-bold">+{sig.preOpenChange.toFixed(2)}%</td>
                        <td className="text-cyan font-bold">{sig.signalTime}</td>
                        <td className="text-yellow font-bold">{fmtPrice(sig.price)}</td>
                        <td className="font-bold">{sig.setupLevelName} {fmtPrice(sig.setupLevel)}</td>
                        <td>{fmtVol(sig.volume)}</td>
                        <td>{fmtVol(sig.volumeMA)}</td>
                        <td>{fmtVol(sig.previousVolume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No SELL arrow signal yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CONFIRMED SIGNALS ═══ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="section-title">Final Confirmed Signals</h2>
          <p className="section-subtitle">
            Immediate next candle only. BUY is final when next 1m Close &gt; BUY signal candle High. SELL is final when next 1m Close &lt; SELL signal candle Low. A later candle never rescues a failed confirmation. The yellow chart dot marks this final confirmation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Confirmed BUY */}
          <div className="confirmed-panel buy-panel">
            <div className="confirmed-header">
              <h3>Confirmed BUY</h3>
              <span className="final-badge buy-badge">
                {data?.pivotSignals?.counts.confirmedBuy ?? 0} FINAL BUY
                <span className="final-dot" />
              </span>
            </div>
            <div className="confirmed-body">
              {data?.pivotSignals?.confirmedBuy?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Price</th>
                      <th>Level</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pivotSignals.confirmedBuy.map((sig) => (
                      <tr key={sig.symbol}>
                        <td className="font-bold">{sig.symbol}</td>
                        <td className="text-green font-bold">{fmtPrice(sig.price)}</td>
                        <td>{sig.setupLevelName}</td>
                        <td>{sig.signalTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No FINAL CONFIRMED BUY signal yet.</div>
              )}
            </div>
          </div>

          {/* Confirmed SELL */}
          <div className="confirmed-panel sell-panel">
            <div className="confirmed-header">
              <h3>Confirmed SELL</h3>
              <span className="final-badge sell-badge">
                {data?.pivotSignals?.counts.confirmedSell ?? 0} FINAL SELL
                <span className="final-dot" />
              </span>
            </div>
            <div className="confirmed-body">
              {data?.pivotSignals?.confirmedSell?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Price</th>
                      <th>Level</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pivotSignals.confirmedSell.map((sig) => (
                      <tr key={sig.symbol}>
                        <td className="font-bold">{sig.symbol}</td>
                        <td className="text-red font-bold">{fmtPrice(sig.price)}</td>
                        <td>{sig.setupLevelName}</td>
                        <td>{sig.signalTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No FINAL CONFIRMED SELL signal yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TWS PDH/PDL SCREENER SECTION ═══ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="section-title">TWS PDH/PDL Break & Retest</h2>
          <p className="section-subtitle mt-2" style={{ maxWidth: '80%' }}>
            Screener for the "Trading With Sidhant" strategy. Identifies stocks where the 15-min candle breaks the Previous Day High (PDH) or Low (PDL) and successfully retests the level with a directional pin bar or engulfing candle within the entry window.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LONG Signals */}
          <div className="signal-panel">
            <div className="signal-header">
              <h3>TWS Long Setups</h3>
              <span className="signal-count buy-count">
                {data?.twsSignals?.long?.length ?? 0} LONG
              </span>
            </div>
            <div className="signal-body">
              {data?.twsSignals?.long?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Entry</th>
                      <th>SL</th>
                      <th>T1 (2R)</th>
                      <th>T2 (3R)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.twsSignals.long.map((sig) => (
                      <tr key={sig.symbol}>
                        <td>
                          <div className="font-bold text-green">↑ {sig.symbol}</div>
                          <div className="signal-symbol-info text-[0.7rem] leading-tight mt-1">{sig.trigger}</div>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${sig.status.includes('ACTIVE') ? 'bg-green-900/40 text-green-400' : 'bg-cyan-900/40 text-cyan-400'}`}>
                            {sig.status}
                          </span>
                        </td>
                        <td className="text-yellow font-bold">{sig.entryPx ? fmtPrice(sig.entryPx) : '—'}</td>
                        <td className="text-red font-medium">{sig.stopPx ? fmtPrice(sig.stopPx) : '—'}</td>
                        <td className="text-blue font-medium">{sig.tgt1 ? fmtPrice(sig.tgt1) : '—'}</td>
                        <td className="text-green font-medium">{sig.tgt2 ? fmtPrice(sig.tgt2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No TWS Long signals found yet.</div>
              )}
            </div>
          </div>

          {/* SHORT Signals */}
          <div className="signal-panel">
            <div className="signal-header">
              <h3>TWS Short Setups</h3>
              <span className="signal-count sell-count">
                {data?.twsSignals?.short?.length ?? 0} SHORT
              </span>
            </div>
            <div className="signal-body">
              {data?.twsSignals?.short?.length ? (
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Entry</th>
                      <th>SL</th>
                      <th>T1 (2R)</th>
                      <th>T2 (3R)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.twsSignals.short.map((sig) => (
                      <tr key={sig.symbol}>
                        <td>
                          <div className="font-bold text-red">↓ {sig.symbol}</div>
                          <div className="signal-symbol-info text-[0.7rem] leading-tight mt-1">{sig.trigger}</div>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${sig.status.includes('ACTIVE') ? 'bg-red-900/40 text-red-400' : 'bg-orange-900/40 text-orange-400'}`}>
                            {sig.status}
                          </span>
                        </td>
                        <td className="text-yellow font-bold">{sig.entryPx ? fmtPrice(sig.entryPx) : '—'}</td>
                        <td className="text-red font-medium">{sig.stopPx ? fmtPrice(sig.stopPx) : '—'}</td>
                        <td className="text-blue font-medium">{sig.tgt1 ? fmtPrice(sig.tgt1) : '—'}</td>
                        <td className="text-green font-medium">{sig.tgt2 ? fmtPrice(sig.tgt2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="signal-empty">No TWS Short signals found yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ INTRADAY SCANNER SECTION ═══ */}
      <section className="mb-4">
        <div className="mb-4">
          <h2 className="section-title">Intraday Scanner</h2>
          {data?.moversSessionLabel && (
            <span className="date-badge">{data.moversSessionLabel}</span>
          )}
          <p className="section-subtitle">Combined FOSec + NIFTY + BANKNIFTY response. Click any symbol to open its interactive chart.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Intraday Gainers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Gainers</h3>
              <span className="badge-green">Low ≈ Open</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Change</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">Low</th>
                    <th className="text-right">LTP</th>
                  </tr>
                </thead>
                <tbody>
                  {intradayGainers.map((item) => (
                    <tr key={item.symbol}>
                      <td className="font-bold">
                        {item.symbol}
                        <span className={`source-badge ${getSourceClass(item.source)}`}>{item.source}</span>
                      </td>
                      <td className="text-right font-bold text-green">+{item.perChange?.toFixed(2)}%</td>
                      <td className="text-right">{fmtPrice(item.open)}</td>
                      <td className="text-right">{fmtPrice(item.low)}</td>
                      <td className="text-right font-medium">{fmtPrice(item.ltp)}</td>
                    </tr>
                  ))}
                  {!intradayGainers.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted">No matched gainers (Open − Low &lt; ₹0.25)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intraday Losers */}
          <div className="table-panel">
            <div className="table-header">
              <h3>Top Losers</h3>
              <span className="badge-red">High ≈ Open</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="text-right">Change</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">High</th>
                    <th className="text-right">LTP</th>
                  </tr>
                </thead>
                <tbody>
                  {intradayLosers.map((item) => (
                    <tr key={item.symbol}>
                      <td className="font-bold">
                        {item.symbol}
                        <span className={`source-badge ${getSourceClass(item.source)}`}>{item.source}</span>
                      </td>
                      <td className="text-right font-bold text-red">{item.perChange?.toFixed(2)}%</td>
                      <td className="text-right">{fmtPrice(item.open)}</td>
                      <td className="text-right">{fmtPrice(item.high)}</td>
                      <td className="text-right font-medium">{fmtPrice(item.ltp)}</td>
                    </tr>
                  ))}
                  {!intradayLosers.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted">No matched losers (High − Open &lt; ₹0.25)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="app-footer">
        <span>Data source: NSE public website endpoints via your server.</span>
        <span>For trading decisions, verify prices with your broker/exchange terminal.</span>
      </footer>

    </main>
  );
}
