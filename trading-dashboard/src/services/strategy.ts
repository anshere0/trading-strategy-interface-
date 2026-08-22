export type Candle = {
  timestamp: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TwsSignal = {
  symbol: string;
  ltp: number;
  status: 'LONG ACTIVE' | 'SHORT ACTIVE' | 'PDH BROKEN' | 'PDL BROKEN' | 'WAITING FOR BREAK';
  trigger: string;
  entryPx?: number;
  stopPx?: number;
  tgt1?: number;
  tgt2?: number;
  time: string;
};

// Math helpers
function avg(arr: number[]) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateATR(candles: Candle[], period = 14): number[] {
  const tr: number[] = [];
  const atr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      tr.push(c.high - c.low);
      atr.push(tr[0]);
    } else {
      const pc = candles[i - 1];
      const hl = c.high - c.low;
      const hpc = Math.abs(c.high - pc.close);
      const lpc = Math.abs(c.low - pc.close);
      const t = Math.max(hl, hpc, lpc);
      tr.push(t);
      // simple moving average for first ATR, then Wilder's
      if (i < period) {
        atr.push(avg(tr));
      } else {
        atr.push((atr[i - 1] * (period - 1) + t) / period);
      }
    }
  }
  return atr;
}

export function evaluateTwsStrategy(
  symbol: string,
  tradingSymbol: string,
  dailyHistory: Candle[],
  intradayHistory: Candle[] // Must be 15m candles ordered ascending
): TwsSignal | null {
  if (dailyHistory.length < 2) return null; // Need previous day

  const pdh = dailyHistory[dailyHistory.length - 2].high;
  const pdl = dailyHistory[dailyHistory.length - 2].low;
  
  if (intradayHistory.length === 0) return null;
  const lastLtp = intradayHistory[intradayHistory.length - 1].close;
  
  let bias = 0; // 1 = LONG, -1 = SHORT
  let armedTime = '';
  
  const atrArray = calculateATR(intradayHistory, 14);

  // Default signal state
  let currentSignal: TwsSignal = {
    symbol: tradingSymbol,
    ltp: lastLtp,
    status: 'WAITING FOR BREAK',
    trigger: 'Waiting for PDH/PDL break',
    time: ''
  };

  // Loop through today's 15m candles
  let leftLevel = false;

  for (let i = 1; i < intradayHistory.length; i++) {
    const candle = intradayHistory[i];
    const prevCandle = intradayHistory[i - 1];
    const atr = atrArray[i];

    const d = new Date(candle.timestamp);
    const hhmm = d.getHours() * 100 + d.getMinutes();
    const inWindow = hhmm >= 915 && hhmm <= 1145;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // Step 2: 15-min break of PDH/PDL
    const brokeUp = prevCandle.close > pdh;
    const brokeDown = prevCandle.close < pdl;

    if (bias === 0 && inWindow) {
      if (brokeUp) {
        bias = 1;
        armedTime = timeStr;
        currentSignal.status = 'PDH BROKEN';
        currentSignal.trigger = 'Watch for retest';
        currentSignal.time = armedTime;
      } else if (brokeDown) {
        bias = -1;
        armedTime = timeStr;
        currentSignal.status = 'PDL BROKEN';
        currentSignal.trigger = 'Watch for retest';
        currentSignal.time = armedTime;
      }
    }

    // Void the break
    if (bias === 1 && prevCandle.close < pdh) { bias = 0; leftLevel = false; }
    if (bias === -1 && prevCandle.close > pdl) { bias = 0; leftLevel = false; }

    if (bias === 0) continue;

    const level = bias === 1 ? pdh : pdl;

    // Step 4: Touch of the line
    if ((bias === 1 && candle.low > level) || (bias === -1 && candle.high < level)) {
      leftLevel = true;
    }

    const touch = candle.low <= level && candle.high >= level;
    const touchPrv = prevCandle.low <= level && prevCandle.high >= level;

    // Approach Efficiency (Lookback = 4)
    let effRatio = 0;
    let cleanApproachLong = false;
    let cleanApproachShort = false;

    if (i >= 4) {
      const approachCandles = intradayHistory.slice(i - 4, i);
      const netChg = candle.close - intradayHistory[i - 4].close;
      let pathLen = 0;
      let appHigh = -Infinity;
      let appLow = Infinity;
      let priorTouch = false;

      for (let j = 0; j < approachCandles.length; j++) {
        if (j > 0) pathLen += Math.abs(approachCandles[j].close - approachCandles[j - 1].close);
        appHigh = Math.max(appHigh, approachCandles[j].high);
        appLow = Math.min(appLow, approachCandles[j].low);
        if (approachCandles[j].low <= level && approachCandles[j].high >= level) {
          priorTouch = true;
        }
      }

      effRatio = pathLen > 0 ? Math.abs(netChg) / pathLen : 0;
      const appRange = appHigh - appLow;
      
      const noPriorTag = !priorTouch;
      const impulsive = effRatio >= 0.55;
      const notCoiled = atr > 0 && appRange >= 1.2 * atr;
      const fallingIn = netChg < 0;
      const risingIn = netChg > 0;

      cleanApproachLong = noPriorTag && impulsive && notCoiled && fallingIn;
      cleanApproachShort = noPriorTag && impulsive && notCoiled && risingIn;
    }

    // Step 5: Entry Patterns
    const bodySz = Math.abs(candle.close - candle.open);
    const bodyRef = Math.max(bodySz, 0.05); // tick size
    const bodyTop = Math.max(candle.open, candle.close);
    const bodyBot = Math.min(candle.open, candle.close);
    const upWick = candle.high - bodyTop;
    const dnWick = bodyBot - candle.low;
    const rng = candle.high - candle.low;

    const bigEnough = rng > 0 && rng >= 0.60 * atr;
    const closeTopPct = rng > 0 ? (candle.close - candle.low) / rng : 0;
    const closeBotPct = rng > 0 ? (candle.high - candle.close) / rng : 0;

    const hammer = bigEnough && candle.close > candle.open &&
      dnWick >= 2.0 * bodyRef && dnWick >= 0.60 * rng &&
      upWick <= 0.20 * rng && closeTopPct >= 0.60;

    const shooter = bigEnough && candle.close < candle.open &&
      upWick >= 2.0 * bodyRef && upWick >= 0.60 * rng &&
      dnWick <= 0.20 * rng && closeBotPct >= 0.60;

    // Engulfing
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const prevRng = Math.max(prevCandle.high - prevCandle.low, 0.05);
    const prevRealBar = prevBody >= 0.30 * prevRng;
    const decisive = rng > 0 && bodySz >= 0.50 * rng;
    const biggerBody = bodySz >= 1.25 * Math.max(prevBody, 0.05);

    const bullEngulf = bigEnough && (candle.close > candle.open) && (prevCandle.close < prevCandle.open) && prevRealBar && decisive && biggerBody &&
      (candle.high >= prevCandle.high && candle.low <= prevCandle.low) &&
      (candle.close > prevCandle.high);

    const bearEngulf = bigEnough && (candle.close < candle.open) && (prevCandle.close > prevCandle.open) && prevRealBar && decisive && biggerBody &&
      (candle.high >= prevCandle.high && candle.low <= prevCandle.low) &&
      (candle.close < prevCandle.low);

    // Signals
    const longHammer = hammer && touch && cleanApproachLong;
    const longEngulf = bullEngulf && (touch || touchPrv);
    const shortPin = shooter && touch && cleanApproachShort;
    const shortEngulf = bearEngulf && (touch || touchPrv);

    const canFire = inWindow && leftLevel;

    if (canFire && bias === 1 && (longHammer || longEngulf)) {
      const entryPx = candle.close;
      const stopPx = (longHammer ? candle.low : Math.min(candle.low, prevCandle.low)) - 0.10; // buffer
      const r = entryPx - stopPx;
      return {
        symbol: tradingSymbol,
        ltp: lastLtp,
        status: 'LONG ACTIVE',
        trigger: longHammer ? `Pin bar at PDH (eff ${effRatio.toFixed(2)})` : 'Bullish engulfing at PDH',
        entryPx,
        stopPx,
        tgt1: entryPx + 2.0 * r,
        tgt2: entryPx + 3.0 * r,
        time: timeStr
      };
    }

    if (canFire && bias === -1 && (shortPin || shortEngulf)) {
      const entryPx = candle.close;
      const stopPx = (shortPin ? candle.high : Math.max(candle.high, prevCandle.high)) + 0.10; // buffer
      const r = stopPx - entryPx;
      return {
        symbol: tradingSymbol,
        ltp: lastLtp,
        status: 'SHORT ACTIVE',
        trigger: shortPin ? `Pin bar at PDL (eff ${effRatio.toFixed(2)})` : 'Bearish engulfing at PDL',
        entryPx,
        stopPx,
        tgt1: entryPx - 2.0 * r,
        tgt2: entryPx - 3.0 * r,
        time: timeStr
      };
    }
  }

  return currentSignal.status !== 'WAITING FOR BREAK' ? currentSignal : null;
}
