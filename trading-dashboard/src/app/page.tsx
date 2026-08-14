'use client';

import { useState, useEffect, useCallback } from 'react';

type MarketItem = {
  symbol: string;
  ltp: number;
  perChange: number;
  volume: number;
  rvol: string;
};

type PreOpenItem = {
  symbol: string;
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
};

function formatNumber(num: number) {
  if (num >= 10000000) return (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000) return (num / 100000).toFixed(1) + 'L';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function Home() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState<string>('1.25');
  const [threshold, setThreshold] = useState<number>(1.25);
  const [topN, setTopN] = useState<string>('Top 5');

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/market?threshold=${threshold}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json: MarketData = await res.json();
      
      if ((json as any).error) throw new Error((json as any).error);

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 300000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const preOpenGainersDisplay = topN === 'Top 5' ? data?.preOpenGainers?.slice(0, 5) : data?.preOpenGainers;
  const preOpenLosersDisplay = topN === 'Top 5' ? data?.preOpenLosers?.slice(0, 5) : data?.preOpenLosers;

  return (
    <main className="min-h-screen p-4 lg:p-8 animate-fade-in text-sm font-medium">
      
      {error && (
        <div className="p-4 mb-4 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Top Section - Live Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        
        {/* Live Gainers */}
        <section className="glass-panel p-0 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)] bg-[#10151f]">
                <th className="py-2 px-4 font-semibold uppercase">SYMBOL</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">LTP</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">CHG%</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">VOLUME</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">RVOL</th>
              </tr>
            </thead>
            <tbody>
              {data?.gainers?.slice(0, 7).map((item) => (
                <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-bold">{item.symbol}</td>
                  <td className="py-3 px-4 text-right">{item.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right text-[var(--accent-green)]">+{item.perChange?.toFixed(2)}%</td>
                  <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{formatNumber(item.volume)}</td>
                  <td className="py-3 px-4 text-right text-[var(--accent-red)]">{item.rvol}x</td>
                </tr>
              ))}
              {!data?.gainers?.length && !loading && (
                <tr><td colSpan={5} className="py-4 text-center text-[var(--text-secondary)]">No data</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Live Losers */}
        <section className="glass-panel p-0 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)] bg-[#10151f]">
                <th className="py-2 px-4 font-semibold uppercase">SYMBOL</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">LTP</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">CHG%</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">VOLUME</th>
                <th className="py-2 px-4 font-semibold text-right uppercase">RVOL</th>
              </tr>
            </thead>
            <tbody>
              {data?.losers?.slice(0, 7).map((item) => (
                <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-bold">{item.symbol}</td>
                  <td className="py-3 px-4 text-right">{item.ltp?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right text-[var(--accent-red)]">{item.perChange?.toFixed(2)}%</td>
                  <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{formatNumber(item.volume)}</td>
                  <td className="py-3 px-4 text-right text-[var(--accent-red)]">{item.rvol}x</td>
                </tr>
              ))}
              {!data?.losers?.length && !loading && (
                <tr><td colSpan={5} className="py-4 text-center text-[var(--text-secondary)]">No data</td></tr>
              )}
            </tbody>
          </table>
        </section>

      </div>

      {/* Pre Open Screener */}
      <section className="glass-panel p-4 lg:p-6 relative">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-6 gap-4 border-b border-[var(--border-color)] pb-4">
          <h2 className="text-[var(--text-secondary)] font-bold text-sm tracking-wider uppercase">PRE-OPEN SCREENER</h2>
          
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="bg-[#0b0e14] border border-[var(--border-color)] rounded px-3 py-1.5 w-16 text-center focus:outline-none focus:border-[var(--accent-blue)]"
            />
            <span className="text-[var(--text-secondary)] text-sm">% min gap</span>
            
            <select 
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              className="bg-[#0b0e14] border border-[var(--border-color)] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--accent-blue)]"
            >
              <option>Top 5</option>
              <option>Top 10</option>
              <option>All</option>
            </select>

            <button 
              onClick={() => { setThreshold(parseFloat(thresholdInput) || 1.25); fetchMarketData(); }}
              disabled={loading}
              className="bg-[#0b0e14] border border-[var(--border-color)] rounded px-4 py-1.5 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <div className="flex items-center gap-2 bg-[#0b0e14] border border-[var(--border-color)] rounded px-3 py-1.5">
              <span className="text-yellow-500">🔔</span>
              <span className="text-[var(--text-secondary)]">Alerts: Off</span>
            </div>

            <span className="bg-[#1e3a8a]/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded font-bold text-xs">CLOSED</span>
          </div>
        </div>

        <p className="text-[var(--text-secondary)] text-xs mb-6 -mt-2">
          Pre-open data is published only 09:00-09:15 IST on trading days. Next window: tomorrow at 09:00 IST. Refresh checks anyway if you want to confirm.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Pre Open Gainers */}
          <div>
            <h3 className="text-[var(--accent-green)] font-bold mb-4">Top Gainers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="pb-3 font-semibold uppercase">SYMBOL</th>
                    <th className="pb-3 font-semibold text-right uppercase">CHG%</th>
                    <th className="pb-3 font-semibold text-right uppercase">IEP</th>
                    <th className="pb-3 font-semibold text-center uppercase">OH/OL</th>
                    <th className="pb-3 font-semibold text-left uppercase">NEAREST LEVEL</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenGainersDisplay?.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-4 font-bold">{item.symbol}</td>
                      <td className="py-4 text-right text-[var(--accent-green)]">+{item.pChange?.toFixed(2)}%</td>
                      <td className="py-4 text-right font-medium">₹{item.iep?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 text-center">
                        <span className={`badge-${item.ohol === 'OL' ? 'green' : 'red'}`}>{item.ohol}</span>
                      </td>
                      <td className="py-4 text-left">
                        {item.nearestLevel && (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{item.nearestLevel.name}</span>
                              <span className="text-gray-300">₹{item.nearestLevel.value.toFixed(2)}</span>
                              <span className={`badge-${item.nearestLevel.position === 'ABOVE' ? 'green' : 'red'} text-[10px]`}>
                                {item.nearestLevel.position}
                              </span>
                            </div>
                            <span className="text-[var(--text-secondary)] text-xs">{item.nearestLevel.distancePercent.toFixed(2)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!preOpenGainersDisplay?.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">No data match criteria</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pre Open Losers */}
          <div>
            <h3 className="text-[var(--accent-red)] font-bold mb-4">Top Losers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[var(--text-secondary)] text-xs border-b border-[var(--border-color)]">
                    <th className="pb-3 font-semibold uppercase">SYMBOL</th>
                    <th className="pb-3 font-semibold text-right uppercase">CHG%</th>
                    <th className="pb-3 font-semibold text-right uppercase">IEP</th>
                    <th className="pb-3 font-semibold text-center uppercase">OH/OL</th>
                    <th className="pb-3 font-semibold text-left uppercase">NEAREST LEVEL</th>
                  </tr>
                </thead>
                <tbody>
                  {preOpenLosersDisplay?.map((item) => (
                    <tr key={item.symbol} className="border-b border-[var(--border-color)]/50 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-4 font-bold">{item.symbol}</td>
                      <td className="py-4 text-right text-[var(--accent-red)]">{item.pChange?.toFixed(2)}%</td>
                      <td className="py-4 text-right font-medium">₹{item.iep?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 text-center">
                        <span className={`badge-${item.ohol === 'OL' ? 'green' : 'red'}`}>{item.ohol}</span>
                      </td>
                      <td className="py-4 text-left">
                        {item.nearestLevel && (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{item.nearestLevel.name}</span>
                              <span className="text-gray-300">₹{item.nearestLevel.value.toFixed(2)}</span>
                              <span className={`badge-${item.nearestLevel.position === 'ABOVE' ? 'green' : 'red'} text-[10px]`}>
                                {item.nearestLevel.position}
                              </span>
                            </div>
                            <span className="text-[var(--text-secondary)] text-xs">{item.nearestLevel.distancePercent.toFixed(2)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!preOpenLosersDisplay?.length && !loading && (
                    <tr><td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">No data match criteria</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

    </main>
  );
}
