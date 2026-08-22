export class FyersClient {
  private appId: string;
  private accessToken: string;
  private baseUrl = 'https://api-t1.fyers.in/data';

  constructor(appId?: string, accessToken?: string) {
    this.appId = appId || process.env.FYERS_APP_ID || '';
    this.accessToken = accessToken || process.env.FYERS_ACCESS_TOKEN || '';
  }

  isConfigured(): boolean {
    return !!(this.appId && this.accessToken);
  }

  private getAuthHeader(): string {
    return `${this.appId}:${this.accessToken}`;
  }

  async getHistory(
    symbol: string,
    resolution: '1' | '5' | '15' | '30' | '60' | 'D' | '1D' | '1W' | '1M',
    rangeFrom: string, // YYYY-MM-DD
    rangeTo: string    // YYYY-MM-DD
  ) {
    if (!this.isConfigured()) {
      throw new Error('Fyers API credentials not configured');
    }

    const url = new URL(`${this.baseUrl}/history`);
    url.searchParams.append('symbol', symbol);
    url.searchParams.append('resolution', resolution);
    url.searchParams.append('date_format', '1');
    url.searchParams.append('range_from', rangeFrom);
    url.searchParams.append('range_to', rangeTo);
    url.searchParams.append('cont_flag', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fyers History API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.s !== 'ok') {
      throw new Error(`Fyers History API returned status: ${data.s} - ${data.message || 'Unknown error'}`);
    }

    // Format of data.candles: [epoch, open, high, low, close, volume]
    return data.candles.map((c: any) => ({
      timestamp: c[0] * 1000,
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5]
    }));
  }
}

export const fyers = new FyersClient();
