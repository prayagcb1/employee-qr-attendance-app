export interface NetworkDiagnostics {
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  online: boolean;
  userAgent: string;
  supabaseUrl: string;
  timestamp: string;
}

export function getNetworkDiagnostics(): NetworkDiagnostics {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'not configured';

  return {
    connectionType: connection?.type || 'unknown',
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
    saveData: connection?.saveData || false,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    supabaseUrl: supabaseUrl,
    timestamp: new Date().toISOString(),
  };
}

export function logDiagnostics() {
  const diagnostics = getNetworkDiagnostics();
  console.log('=== Network Diagnostics ===');
  console.log('Connection Type:', diagnostics.connectionType);
  console.log('Effective Type:', diagnostics.effectiveType);
  console.log('Downlink (Mbps):', diagnostics.downlink);
  console.log('RTT (ms):', diagnostics.rtt);
  console.log('Save Data:', diagnostics.saveData);
  console.log('Online:', diagnostics.online);
  console.log('User Agent:', diagnostics.userAgent);
  console.log('Supabase URL:', diagnostics.supabaseUrl);
  console.log('Timestamp:', diagnostics.timestamp);
  console.log('=========================');
  return diagnostics;
}

export async function testSupabaseReachability(url: string): Promise<{
  reachable: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
    });

    const latency = performance.now() - startTime;

    return {
      reachable: true,
      latency,
    };
  } catch (error) {
    const latency = performance.now() - startTime;
    return {
      reachable: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
