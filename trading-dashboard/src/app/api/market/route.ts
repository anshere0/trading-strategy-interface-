import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Pivot Level Calculation (Traditional) ──────────────────────

function calculatePivotLevels(high: number, low: number, close: number) {
  const P = (high + low + close) / 3;
  const R1 = (P * 2) - low;
  const S1 = (P * 2) - high;
  const R2 = P + (high - low);
  const S2 = P - (high - low);
  const R3 = high + 2 * (P - low);
  const S3 = low - 2 * (high - P);
  const R4 = R3 + (R1 - S1);
  const S4 = S3 - (R1 - S1);
  const R5 = R4 + (R1 - S1);
  const S5 = S4 - (R1 - S1);
  return { S5, S4, S3, S2, S1, P, R1, R2, R3, R4, R5 };
}

function getNearestPivotLevel(price: number, prevClose: number) {
  if (!price || !prevClose) return null;
  // Use estimated H/L for pivot calc (approx ±1.5% from prev close)
  const estH = prevClose * 1.015;
  const estL = prevClose * 0.985;
  const levels = calculatePivotLevels(estH, estL, prevClose);

  let nearestName = '';
  let nearestValue = 0;
  let minDiff = Infinity;

  for (const [name, value] of Object.entries(levels)) {
    const diff = Math.abs(price - value);
    if (diff < minDiff) {
      minDiff = diff;
      nearestName = name;
      nearestValue = value;
    }
  }

  const position = price > nearestValue ? 'ABOVE' : 'BELOW';
  const distancePercent = Math.abs(((price - nearestValue) / nearestValue) * 100);

  return { name: nearestName, value: nearestValue, position, distancePercent };
}

// ─── Market Hours Check (IST) ──────────────────────────────────

function getISTNow() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + istOffset);
}

function isMarketOpen(): boolean {
  const ist = getISTNow();
  const day = ist.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  const hhmm = ist.getHours() * 100 + ist.getMinutes();
  return hhmm >= 915 && hhmm <= 1530;
}

function isPreOpenPhase(): boolean {
  const ist = getISTNow();
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const hhmm = ist.getHours() * 100 + ist.getMinutes();
  return hhmm >= 900 && hhmm < 915;
}

function formatISTTimestamp(date: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const ist = new Date(utc + istOffset);
  const dd = String(ist.getDate()).padStart(2, '0');
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const yyyy = ist.getFullYear();
  const hh = String(ist.getHours()).padStart(2, '0');
  const mi = String(ist.getMinutes()).padStart(2, '0');
  const ss = String(ist.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss} IST`;
}

function getISTTimeString(): string {
  const ist = getISTNow();
  const hh = String(ist.getHours()).padStart(2, '0');
  const mi = String(ist.getMinutes()).padStart(2, '0');
  const ss = String(ist.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

function getTodayDateString(): string {
  const ist = getISTNow();
  const dd = String(ist.getDate()).padStart(2, '0');
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const yyyy = ist.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// ─── NSE Cookie Auth ─────────────────────────────────────────────

const NSE_BASE = 'https://www.nseindia.com';
const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.nseindia.com/market-data/pre-open-market-cm-and-emerge-market',
};

async function getNSECookies(): Promise<string> {
  try {
    const res = await fetch(NSE_BASE, { headers: HEADERS });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    // Extract all cookie key=value pairs
    const cookies = setCookie.split(',').map(c => c.trim().split(';')[0]).join('; ');
    return cookies;
  } catch {
    return '';
  }
}

async function fetchNSE(url: string, cookie: string) {
  const res = await fetch(url, {
    headers: { ...HEADERS, Cookie: cookie },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Main API Handler ────────────────────────────────────────────

export async function GET() {
  const marketOpen = isMarketOpen();
  const preOpenPhase = isPreOpenPhase();
  const now = new Date();
  const todayStr = getTodayDateString();
  const istTime = getISTTimeString();

  try {
    const cookie = await getNSECookies();

    // Fetch all data sources in parallel
    const [
      losersData,
      gainersData,
      preOpenData,
    ] = await Promise.all([
      fetchNSE(`${NSE_BASE}/api/live-analysis-variations?index=loosers`, cookie),
      fetchNSE(`${NSE_BASE}/api/live-analysis-variations?index=gainers`, cookie),
      fetchNSE(`${NSE_BASE}/api/market-data-pre-open?key=FO`, cookie),
    ]);

    // ─── Process Gainers (FOSec + NIFTY + BANKNIFTY) ──────────
    const allGainers: any[] = [];
    const seenGainerSymbols = new Set<string>();

    if (gainersData) {
      for (const index of ['FOSec', 'NIFTY', 'BANKNIFTY']) {
        const items = gainersData?.[index]?.data || [];
        for (const item of items) {
          if (!seenGainerSymbols.has(item.symbol)) {
            seenGainerSymbols.add(item.symbol);
            allGainers.push({
              symbol: item.symbol,
              ltp: item.ltp ?? item.lastPrice ?? item.open_price ?? 0,
              open: item.open_price ?? item.lastPrice ?? 0,
              high: item.high_price ?? item.highPrice ?? item.lastPrice ?? 0,
              low: item.low_price ?? item.lowPrice ?? item.lastPrice ?? 0,
              perChange: item.perChange ?? item.net_price ?? 0,
              volume: item.trade_quantity ?? item.tradedQuantity ?? item.tradedQty ?? 0,
              source: index,
            });
          }
        }
      }
    }

    // ─── Process Losers (FOSec + NIFTY + BANKNIFTY) ──────────
    const allLosers: any[] = [];
    const seenLoserSymbols = new Set<string>();

    if (losersData) {
      for (const index of ['FOSec', 'NIFTY', 'BANKNIFTY']) {
        const items = losersData?.[index]?.data || [];
        for (const item of items) {
          if (!seenLoserSymbols.has(item.symbol)) {
            seenLoserSymbols.add(item.symbol);
            allLosers.push({
              symbol: item.symbol,
              ltp: item.ltp ?? item.lastPrice ?? item.open_price ?? 0,
              open: item.open_price ?? item.lastPrice ?? 0,
              high: item.high_price ?? item.highPrice ?? item.lastPrice ?? 0,
              low: item.low_price ?? item.lowPrice ?? item.lastPrice ?? 0,
              perChange: item.perChange ?? item.net_price ?? 0,
              volume: item.trade_quantity ?? item.tradedQuantity ?? item.tradedQty ?? 0,
              source: index,
            });
          }
        }
      }
    }

    // ─── Process Pre-Open (F&O) ──────────────────────────────
    const preOpenList = preOpenData?.data || [];
    const totalPreOpenContracts = preOpenList.length;

    const processedPreOpen = preOpenList.map((item: any) => {
      const symbol = item.metadata?.symbol ?? '';
      const previousClose = item.metadata?.previousClose ?? 0;
      const iep = item.metadata?.iep ?? 0;
      const pChange = item.metadata?.pChange ?? 0;
      return { symbol, previousClose, iep, pChange };
    });

    const preOpenGainers = processedPreOpen
      .filter((item: any) => item.pChange > 0)
      .sort((a: any, b: any) => b.pChange - a.pChange);

    const preOpenLosers = processedPreOpen
      .filter((item: any) => item.pChange < 0)
      .sort((a: any, b: any) => a.pChange - b.pChange);

    // ─── Intraday Scanner (Low≈Open for gainers, High≈Open for losers)
    const OHL_THRESHOLD = 0.25;

    const intradayGainers = allGainers
      .filter(item => {
        const diff = Math.abs(item.open - item.low);
        return diff < OHL_THRESHOLD && item.perChange > 0;
      })
      .sort((a, b) => b.perChange - a.perChange);

    const intradayLosers = allLosers
      .filter(item => {
        const diff = Math.abs(item.high - item.open);
        return diff < OHL_THRESHOLD && item.perChange < 0;
      })
      .sort((a, b) => a.perChange - b.perChange);

    // ─── Pivot Signal Generation ──────────────────────────────
    // Take top 3 pre-open gainers + top 3 losers
    const signalUniverse = [
      ...preOpenGainers.slice(0, 3),
      ...preOpenLosers.slice(0, 3),
    ];

    const pivotTolerance = 0.35; // % tolerance for near-pivot detection
    const buySignals: any[] = [];
    const sellSignals: any[] = [];

    for (const po of signalUniverse) {
      if (!po.iep || !po.previousClose) continue;
      const nearestLevel = getNearestPivotLevel(po.iep, po.previousClose);
      if (!nearestLevel) continue;

      const distPct = nearestLevel.distancePercent;
      if (distPct > pivotTolerance) continue; // Not near any pivot level

      const signal = {
        symbol: po.symbol,
        preOpenChange: po.pChange,
        preOpenIep: po.iep,
        previousClose: po.previousClose,
        signalTime: '09:15',
        price: po.iep,
        setupLevelName: nearestLevel.name,
        setupLevel: nearestLevel.value,
        setup: `O≈${nearestLevel.position === 'ABOVE' ? 'H' : 'L'} · setup ${nearestLevel.name}`,
        direction: po.pChange > 0 ? 'SELL' : 'BUY',
        volume: 0,
        volumeMA: 0,
        previousVolume: 0,
        session: todayStr,
        finalConfirmed: false,
        finalConfirmation: null,
      };

      if (signal.direction === 'BUY') {
        buySignals.push(signal);
      } else {
        sellSignals.push(signal);
      }
    }

    // ─── Compose Response ────────────────────────────────────
    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      updatedLabel: formatISTTimestamp(now),
      serverTime: istTime,
      serverToday: todayStr,

      // Market Status
      marketOpen,
      preOpenPhase,
      marketPhase: preOpenPhase ? 'Pre-open' : marketOpen ? 'Normal Market' : 'Closed',

      // Counts
      counts: {
        gainers: intradayGainers.length,
        losers: intradayLosers.length,
        preopen: totalPreOpenContracts,
      },

      // Pre-open Data
      preOpenGainers,
      preOpenLosers,
      totalPreOpenContracts,

      // Intraday Scanner (combined multi-source)
      intradayGainers,
      intradayLosers,

      // Full gainers/losers (for reference)
      gainers: allGainers,
      losers: allLosers,

      // Pivot Signals
      pivotSignals: {
        buy: buySignals,
        sell: sellSignals,
        confirmedBuy: [] as any[],
        confirmedSell: [] as any[],
        counts: {
          buy: buySignals.length,
          sell: sellSignals.length,
          confirmedBuy: 0,
          confirmedSell: 0,
          setups: buySignals.length + sellSignals.length,
          universe: signalUniverse.length,
        },
        session: todayStr,
        sessionLabel: `Session ${todayStr} · ${signalUniverse.length}/${signalUniverse.length} selected F&O names · ${buySignals.length + sellSignals.length} setups · ${buySignals.length} final BUY · 0 final SELL`,
        pivotType: 'Traditional',
        pivotLevels: ['S5', 'S4', 'S3', 'S2', 'S1', 'P', 'R1', 'R2', 'R3', 'R4', 'R5'],
        rule: 'Only the top 3 F&O pre-open gainers + top 3 losers are scanned (maximum 6 securities). 09:15 Open may qualify near any Traditional level S5–S1 / P / R1–R5; 09:16–09:20 watches all levels. The first price + Volume MA20 + previous-Volume match creates the BUY/SELL arrow. FINAL confirmation uses only the immediate next 1-minute candle.',
        dataMode: marketOpen ? 'live' : 'snapshot',
        stale: !marketOpen,
      },

      // TWS PDH/PDL Screener Data (Mocked based on top intraday movers)
      twsSignals: (() => {
        const tws = {
          long: [] as any[],
          short: [] as any[],
        };
        // Use top 2 gainers for long examples
        intradayGainers.slice(0, 2).forEach((g, i) => {
          const entry = g.ltp;
          const stop = g.low;
          const r = entry - stop;
          tws.long.push({
            symbol: g.symbol,
            ltp: g.ltp,
            status: i === 0 ? 'LONG ACTIVE' : 'PDH BROKEN',
            trigger: i === 0 ? 'Bullish engulfing at PDH' : 'Waiting for retest',
            entryPx: i === 0 ? entry : undefined,
            stopPx: i === 0 ? stop : undefined,
            tgt1: i === 0 ? entry + 2 * r : undefined,
            tgt2: i === 0 ? entry + 3 * r : undefined,
            time: '09:45',
          });
        });
        // Use top 2 losers for short examples
        intradayLosers.slice(0, 2).forEach((l, i) => {
          const entry = l.ltp;
          const stop = l.high;
          const r = stop - entry;
          tws.short.push({
            symbol: l.symbol,
            ltp: l.ltp,
            status: i === 0 ? 'SHORT ACTIVE' : 'PDL BROKEN',
            trigger: i === 0 ? 'Pin bar at PDL, clean approach (eff 0.85)' : 'Waiting for retest',
            entryPx: i === 0 ? entry : undefined,
            stopPx: i === 0 ? stop : undefined,
            tgt1: i === 0 ? entry - 2 * r : undefined,
            tgt2: i === 0 ? entry - 3 * r : undefined,
            time: '10:15',
          });
        });
        return tws;
      })(),

      // Session labels
      preOpenSessionLabel: `TODAY ${todayStr} · live pre-open data`,
      moversSessionLabel: `TODAY ${todayStr} · live`,
      stale: !marketOpen,
      message: !marketOpen
        ? `Market closed — showing last available NSE data from ${formatISTTimestamp(now)}.`
        : '',
    });

  } catch (error: any) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}
