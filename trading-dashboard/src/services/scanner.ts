import { fyers } from './fyers';
import { getNifty500Symbols } from './symbols';
import { evaluateTwsStrategy, TwsSignal } from './strategy';

let cachedSignals: { long: TwsSignal[], short: TwsSignal[] } = { long: [], short: [] };
let lastScanTime = 0;
let isScanning = false;

function getYyyyMmDd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Simple concurrency limit
async function asyncPool<T, R>(poolLimit: number, array: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

export async function runScan() {
  if (isScanning) return cachedSignals;
  if (!fyers.isConfigured()) {
    console.log('[Scanner] Fyers API not configured. Returning empty signals.');
    return cachedSignals;
  }
  
  isScanning = true;
  try {
    const symbols = await getNifty500Symbols();
    
    // We need yesterday and today's dates
    const now = new Date();
    const today = getYyyyMmDd(now);
    
    // Get a rough "yesterday" skipping weekends. 
    // In production, we'd fetch a larger daily range (e.g., last 5 days) to ensure we have the previous trading day.
    const lastWeek = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const rangeFrom = getYyyyMmDd(lastWeek);
    const rangeTo = today;

    const long: TwsSignal[] = [];
    const short: TwsSignal[] = [];

    // Scan in pools of 10 concurrent requests to respect rate limits
    await asyncPool(10, symbols, async (sym) => {
      try {
        // Fetch Daily
        const dailyHistory = await fyers.getHistory(sym.fyersSymbol, 'D', rangeFrom, rangeTo);
        // Fetch 15m
        const intradayHistory = await fyers.getHistory(sym.fyersSymbol, '15', rangeFrom, rangeTo);
        
        // Filter intraday for today only
        const todayStartTs = new Date(`${today}T00:00:00+05:30`).getTime();
        const todayIntraday = intradayHistory.filter(c => c.timestamp >= todayStartTs);

        const signal = evaluateTwsStrategy(sym.fyersSymbol, sym.tradingSymbol, dailyHistory, todayIntraday);
        if (signal) {
          if (signal.status.includes('LONG') || signal.status === 'PDH BROKEN') {
            long.push(signal);
          } else if (signal.status.includes('SHORT') || signal.status === 'PDL BROKEN') {
            short.push(signal);
          }
        }
      } catch (err) {
        // Silently catch symbol errors (e.g., invalid symbol or no data)
      }
    });

    cachedSignals = { long, short };
    lastScanTime = Date.now();
  } catch (err) {
    console.error('[Scanner] Scan failed:', err);
  } finally {
    isScanning = false;
  }

  return cachedSignals;
}

export function getCachedSignals() {
  return {
    signals: cachedSignals,
    lastScanTime,
    isScanning
  };
}
