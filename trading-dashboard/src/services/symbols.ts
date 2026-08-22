import { parse } from 'csv-parse/sync';

export type FyersSymbol = {
  fyersSymbol: string; // e.g., NSE:RELIANCE-EQ
  tradingSymbol: string; // e.g., RELIANCE
};

const INDICES: FyersSymbol[] = [
  { fyersSymbol: 'NSE:NIFTY50-INDEX', tradingSymbol: 'NIFTY' },
  { fyersSymbol: 'NSE:NIFTYBANK-INDEX', tradingSymbol: 'BANKNIFTY' },
  { fyersSymbol: 'BSE:SENSEX-INDEX', tradingSymbol: 'SENSEX' },
  { fyersSymbol: 'NSE:NIFTYMIDCAP100-INDEX', tradingSymbol: 'MIDCAP NIFTY' }
];

export async function getNifty500Symbols(): Promise<FyersSymbol[]> {
  try {
    const res = await fetch('https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch Nifty 500 list');
    }
    
    const csvText = await res.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true
    });
    
    const symbols = records.map((row: any) => ({
      fyersSymbol: `NSE:${row.Symbol}-EQ`,
      tradingSymbol: row.Symbol
    }));
    
    return [...INDICES, ...symbols];
  } catch (err) {
    console.error('Error fetching Nifty 500:', err);
    // Fallback to indices if Nifty 500 fails
    return INDICES;
  }
}
