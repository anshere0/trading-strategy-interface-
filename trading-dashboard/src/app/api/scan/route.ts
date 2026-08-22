import { NextResponse } from 'next/server';
import { runScan, getCachedSignals } from '../../../services/scanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { signals, lastScanTime, isScanning } = getCachedSignals();
  
  // Trigger a scan in the background if not currently scanning
  // and if the last scan was more than 30 seconds ago
  if (!isScanning && Date.now() - lastScanTime > 30000) {
    // Fire and forget
    runScan().catch(err => console.error('Background scan error:', err));
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    lastScanTime: lastScanTime ? new Date(lastScanTime).toISOString() : null,
    isScanning,
    twsSignals: signals
  });
}
