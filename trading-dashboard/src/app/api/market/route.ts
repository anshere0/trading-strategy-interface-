import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function calculatePivotLevels(prevClose: number) {
  // MOCK: Since we don't have true High/Low from the NSE API for previous day easily, 
  // we mock them to calculate mathematical pivot points for demonstration.
  const H = prevClose * 1.015; 
  const L = prevClose * 0.985;
  const C = prevClose;
  
  const P = (H + L + C) / 3;
  const R1 = (P * 2) - L;
  const S1 = (P * 2) - H;
  const R2 = P + (H - L);
  const S2 = P - (H - L);
  const R3 = H + 2 * (P - L);
  const S3 = L - 2 * (H - P);

  return { S3, S2, S1, P, R1, R2, R3 };
}

function getNearestLevel(iep: number, prevClose: number) {
  if (!iep || !prevClose) return null;
  const levels = calculatePivotLevels(prevClose);
  
  let nearestName = '';
  let nearestValue = 0;
  let minDiff = Infinity;

  for (const [name, value] of Object.entries(levels)) {
    const diff = Math.abs(iep - value);
    if (diff < minDiff) {
      minDiff = diff;
      nearestName = name;
      nearestValue = value;
    }
  }

  const isAbove = iep > nearestValue;
  const percentDiff = Math.abs(((iep - nearestValue) / nearestValue) * 100);

  return {
    name: nearestName,
    value: nearestValue,
    position: isAbove ? 'ABOVE' : 'BELOW',
    distancePercent: percentDiff
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const thresholdParam = searchParams.get('threshold');
  const threshold = thresholdParam ? parseFloat(thresholdParam) : 1.25;
  const maxThresholdParam = searchParams.get('maxThreshold');
  const maxThreshold = maxThresholdParam ? parseFloat(maxThresholdParam) : 5.0;

  const url1 = "https://www.nseindia.com/api/live-analysis-variations?index=loosers";
  const url2 = "https://www.nseindia.com/api/live-analysis-variations?index=gainers";
  const preOpenUrl = "https://www.nseindia.com/api/market-data-pre-open?key=FO";
  const baseUrl = "https://www.nseindia.com";
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.nseindia.com/market-data/pre-open-market-cm-and-emerge-market"
  };

  try {
    const initialResponse = await fetch(baseUrl, { headers });
    const setCookieHeader = initialResponse.headers.get('set-cookie');
    
    const fetchHeaders = {
      ...headers,
      "Cookie": setCookieHeader ? setCookieHeader.split(';')[0] : ""
    };

    // Losers
    const losersResponse = await fetch(url1, { headers: fetchHeaders });
    let topLosers = [];
    if (losersResponse.ok) {
      const losersData = await losersResponse.json();
      topLosers = (losersData?.FOSec?.data || [])
        .slice(0, 15)
        .map((item: any) => ({
          symbol: item.symbol,
          ltp: item.lastPrice || item.open_price, // fallback if lastPrice isn't there
          perChange: item.perChange,
          volume: item.tradedQty || Math.floor(Math.random() * 50000) + 1000,
          rvol: (Math.random() * 3 + 0.5).toFixed(2), // MOCK RVOL
        }));
    }

    // Gainers
    const gainersResponse = await fetch(url2, { headers: fetchHeaders });
    let topGainers = [];
    if (gainersResponse.ok) {
      const gainersData = await gainersResponse.json();
      topGainers = (gainersData?.FOSec?.data || [])
        .slice(0, 15)
        .map((item: any) => ({
          symbol: item.symbol,
          ltp: item.lastPrice || item.open_price, // fallback if lastPrice isn't there
          perChange: item.perChange,
          volume: item.tradedQty || Math.floor(Math.random() * 50000) + 1000,
          rvol: (Math.random() * 3 + 0.5).toFixed(2), // MOCK RVOL
        }));
    }

    // Pre-Open
    const preOpenResponse = await fetch(preOpenUrl, { headers: fetchHeaders });
    let preOpenGainers = [];
    let preOpenLosers = [];
    if (preOpenResponse.ok) {
      const preOpenData = await preOpenResponse.json();
      const preOpenList = preOpenData?.data || [];
      
      const processedPreOpen = preOpenList.map((item: any) => {
        const symbol = item.metadata.symbol;
        const previousClose = item.metadata.previousClose;
        const iep = item.metadata.iep;
        const pChange = item.metadata.pChange;
        
        // MOCK OH/OL: randomly assign OH or OL for demonstration if gap is large enough
        let ohol = '-';
        if (pChange > 0) ohol = 'OL';
        if (pChange < 0) ohol = 'OH';

        return {
          symbol,
          previousClose,
          iep,
          pChange,
          ohol,
          nearestLevel: getNearestLevel(iep, previousClose)
        };
      });

      preOpenGainers = processedPreOpen
        .filter((item: any) => item.pChange >= threshold && item.pChange <= maxThreshold)
        .sort((a: any, b: any) => b.pChange - a.pChange);

      preOpenLosers = processedPreOpen
        .filter((item: any) => item.pChange <= -threshold && item.pChange >= -maxThreshold)
        .sort((a: any, b: any) => a.pChange - b.pChange); // More negative first
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      losers: topLosers,
      gainers: topGainers,
      preOpenGainers: preOpenGainers,
      preOpenLosers: preOpenLosers,
    });

  } catch (error: any) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error.message },
      { status: 500 }
    );
  }
}
