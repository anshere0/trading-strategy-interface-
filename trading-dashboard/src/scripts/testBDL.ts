import { fyers } from '../services/fyers';
import { evaluateTwsStrategy, Candle } from '../services/strategy';

async function run() {
  const symbol = 'NSE:BDL-EQ';
  
  if (!fyers.isConfigured()) {
    console.error('Fyers not configured. Set FYERS_APP_ID and FYERS_ACCESS_TOKEN in .env.local');
    process.exit(1);
  }

  try {
    const today = new Date();
    // Go back 10 days to ensure we have data
    const lastWeek = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    const rangeFrom = lastWeek.toISOString().split('T')[0];
    const rangeTo = today.toISOString().split('T')[0];

    console.log(`Fetching BDL data from ${rangeFrom} to ${rangeTo}...`);
    
    const dailyHistory = await fyers.getHistory(symbol, 'D', rangeFrom, rangeTo);
    const intradayHistory = await fyers.getHistory(symbol, '15', rangeFrom, rangeTo);
    
    if (dailyHistory.length < 2) {
      console.log('Not enough daily history');
      return;
    }

    // Isolate today's intraday
    // Wait, the user might be referring to a signal on a SPECIFIC DAY in the past.
    // Let's run the strategy for EACH of the last 5 days
    for (let i = 1; i < dailyHistory.length; i++) {
      const currentDayDaily = dailyHistory.slice(0, i + 1);
      const currentDay = new Date(dailyHistory[i].timestamp);
      
      const dayStart = new Date(currentDay);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(currentDay);
      dayEnd.setHours(23,59,59,999);
      
      const dayIntraday = intradayHistory.filter(
        (c: Candle) => c.timestamp >= dayStart.getTime() && c.timestamp <= dayEnd.getTime()
      );
      
      if (dayIntraday.length > 0) {
        console.log(`\nEvaluating ${currentDay.toDateString()} (PDH: ${currentDayDaily[currentDayDaily.length - 2].high}, PDL: ${currentDayDaily[currentDayDaily.length - 2].low})`);
        
        const signal = evaluateTwsStrategy(symbol, 'BDL', currentDayDaily, dayIntraday);
        if (signal) {
          console.log('>>> SIGNAL FOUND:', signal);
        } else {
          console.log('No signal.');
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
