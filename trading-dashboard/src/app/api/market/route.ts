import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const thresholdParam = searchParams.get('threshold');
  const threshold = thresholdParam ? parseFloat(thresholdParam) : 0.25;

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
    // 1. Fetch initial cookies to establish a session (important for NSE API)
    const initialResponse = await fetch(baseUrl, { headers });
    const setCookieHeader = initialResponse.headers.get('set-cookie');
    
    const fetchHeaders = {
      ...headers,
      "Cookie": setCookieHeader ? setCookieHeader.split(';')[0] : ""
    };

    // 2. Fetch Losers Data
    const losersResponse = await fetch(url1, { headers: fetchHeaders });
    if (!losersResponse.ok) throw new Error(`Losers API Failed: ${losersResponse.status}`);
    const losersData = await losersResponse.json();
    
    // Process Losers
    const losersList = losersData?.FOSec?.data || [];
    const topLosers = losersList
      .filter((item: any) => (item.high_price - item.open_price) < threshold)
      .slice(0, 15)
      .map((item: any) => ({
        symbol: item.symbol,
        perChange: item.perChange,
        open_price: item.open_price,
        high_price: item.high_price,
      }));

    // 3. Fetch Gainers Data
    const gainersResponse = await fetch(url2, { headers: fetchHeaders });
    if (!gainersResponse.ok) throw new Error(`Gainers API Failed: ${gainersResponse.status}`);
    const gainersData = await gainersResponse.json();
    
    // Process Gainers
    const gainersList = gainersData?.FOSec?.data || [];
    const topGainers = gainersList
      .filter((item: any) => (item.open_price - item.low_price) < threshold)
      .slice(0, 15)
      .map((item: any) => ({
        symbol: item.symbol,
        perChange: item.perChange,
        open_price: item.open_price,
        low_price: item.low_price,
      }));

    // 4. Fetch Pre-Open Data
    const preOpenResponse = await fetch(preOpenUrl, { headers: fetchHeaders });
    if (!preOpenResponse.ok) throw new Error(`PreOpen API Failed: ${preOpenResponse.status}`);
    const preOpenData = await preOpenResponse.json();
    
    // Process Pre-Open
    const preOpenList = preOpenData?.data || [];
    const topPreOpen = preOpenList
      .slice(0, 20) // Limit to top 20 for performance in UI
      .map((item: any) => ({
        symbol: item.metadata.symbol,
        previousClose: item.metadata.previousClose,
        iep: item.metadata.iep,
        pChange: item.metadata.pChange,
      }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      losers: topLosers,
      gainers: topGainers,
      preOpen: topPreOpen
    });

  } catch (error: any) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error.message },
      { status: 500 }
    );
  }
}
