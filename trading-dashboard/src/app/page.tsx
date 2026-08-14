'use client';

import { useState, useEffect, useCallback } from 'react';

type MarketItem = {
  symbol: string;
  perChange: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
};

type PreOpenItem = {
  symbol: string;
  previousClose: number;
  iep: number;
  pChange: number;
};

type MarketData = {
  timestamp: string;
  losers: MarketItem[];
  gainers: MarketItem[];
  preOpen: PreOpenItem[];
};

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json: MarketData = await res.json();
      
      if ((json as any).error) throw new Error((json as any).error);

      setData(json);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchMarketData();

    // Auto-refresh every 5 minutes (300000 ms)
    const interval = setInterval(fetchMarketData, 300000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  return (
    <main className="min-h-screen p-8 lg:p-24 animate-fade-in">
      <header className="mb-12 flex justify-between items-end border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-2">
            Market <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-[var(--text-secondary)]">Live NSE Market Data Analysis</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            Last Updated: {lastRefreshed || '...'}
          </p>
          <button 
            onClick={fetchMarketData}
            disabled={loading}
            className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[#334155] border border-[var(--border-color)] rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 mb-8 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Top Gainers & Losers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Top Gainers */}
        <section className="glass-panel p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[var(--accent-green)] inline-block"></span>
            Top Gainers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[var(--text-secondary)] text-sm border-b border-[var(--border-color)]">
                  <th className="pb-3 font-medium">SYMBOL</th>
                  <th className="pb-3 font-medium text-right">OPEN</th>
                  <th className="pb-3 font-medium text-right">LOW</th>
                  <th className="pb-3 font-medium text-right">CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {data?.gainers?.map((gainer) => (
                  <tr key={gainer.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium">{gainer.symbol}</td>
                    <td className="py-4 text-right">₹{gainer.open_price?.toFixed(2)}</td>
                    <td className="py-4 text-right">₹{gainer.low_price?.toFixed(2)}</td>
                    <td className="py-4 text-right text-[var(--accent-green)]">
                      +{gainer.perChange?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {!data?.gainers?.length && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No data available</td>
                  </tr>
                )}
                {loading && !data && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)] animate-pulse">Loading...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Losers */}
        <section className="glass-panel p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[var(--accent-red)] inline-block"></span>
            Top Losers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[var(--text-secondary)] text-sm border-b border-[var(--border-color)]">
                  <th className="pb-3 font-medium">SYMBOL</th>
                  <th className="pb-3 font-medium text-right">OPEN</th>
                  <th className="pb-3 font-medium text-right">HIGH</th>
                  <th className="pb-3 font-medium text-right">CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {data?.losers?.map((loser) => (
                  <tr key={loser.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium">{loser.symbol}</td>
                    <td className="py-4 text-right">₹{loser.open_price?.toFixed(2)}</td>
                    <td className="py-4 text-right">₹{loser.high_price?.toFixed(2)}</td>
                    <td className="py-4 text-right text-[var(--accent-red)]">
                      {loser.perChange?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                {!data?.losers?.length && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No data available</td>
                  </tr>
                )}
                {loading && !data && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)] animate-pulse">Loading...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Pre Open Data */}
      <section className="glass-panel p-6">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--accent-blue)] inline-block"></span>
          Pre-Open Market (F&O)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[var(--text-secondary)] text-sm border-b border-[var(--border-color)]">
                <th className="pb-3 font-medium">SYMBOL</th>
                <th className="pb-3 font-medium text-right">PREV CLOSE</th>
                <th className="pb-3 font-medium text-right">IEP (Indicative Eq. Price)</th>
                <th className="pb-3 font-medium text-right">CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {data?.preOpen?.map((item) => (
                <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-4 font-medium">{item.symbol}</td>
                  <td className="py-4 text-right">₹{item.previousClose?.toFixed(2)}</td>
                  <td className="py-4 text-right">₹{item.iep?.toFixed(2)}</td>
                  <td className={`py-4 text-right ${item.pChange >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                    {item.pChange >= 0 ? '+' : ''}{item.pChange?.toFixed(2)}%
                  </td>
                </tr>
              ))}
              {!data?.preOpen?.length && !loading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)]">No data available</td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--text-secondary)] animate-pulse">Loading...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </main>
  );
}
