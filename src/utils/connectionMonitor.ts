type ConnectionStatus = 'online' | 'offline' | 'slow' | 'blocked';

interface ConnectionState {
  status: ConnectionStatus;
  lastSuccessfulConnection: Date | null;
  failedAttempts: number;
  estimatedLatency: number | null;
}

class ConnectionMonitor {
  private state: ConnectionState = {
    status: 'online',
    lastSuccessfulConnection: null,
    failedAttempts: 0,
    estimatedLatency: null,
  };

  private listeners: Set<(state: ConnectionState) => void> = new Set();
  private checkInterval: number | null = null;

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateStatus('online');
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.updateStatus('offline');
      this.notifyListeners();
    });
  }

  startMonitoring(interval = 30000) {
    if (this.checkInterval) return;

    this.checkInterval = window.setInterval(() => {
      this.checkConnection();
    }, interval);

    this.checkConnection();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkConnection() {
    if (!navigator.onLine) {
      this.updateStatus('offline');
      this.state.failedAttempts++;
      this.notifyListeners();
      return;
    }

    const startTime = Date.now();
    const timeout = 5000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      this.state.estimatedLatency = latency;
      this.state.lastSuccessfulConnection = new Date();
      this.state.failedAttempts = 0;

      if (latency > 3000) {
        this.updateStatus('slow');
      } else {
        this.updateStatus('online');
      }

      this.notifyListeners();
    } catch (error) {
      const latency = Date.now() - startTime;
      this.state.failedAttempts++;

      if (latency >= timeout) {
        this.updateStatus('blocked');
      } else {
        this.updateStatus('offline');
      }

      this.notifyListeners();
    }
  }

  private updateStatus(status: ConnectionStatus) {
    this.state.status = status;
  }

  subscribe(callback: (state: ConnectionState) => void) {
    this.listeners.add(callback);
    callback(this.state);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.state));
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  async testSupabaseConnection(supabaseUrl: string, apiKey: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 404) {
        this.state.lastSuccessfulConnection = new Date();
        this.state.failedAttempts = 0;
        return true;
      }

      this.state.failedAttempts++;
      return false;
    } catch (error) {
      this.state.failedAttempts++;
      return false;
    }
  }
}

export const connectionMonitor = new ConnectionMonitor();
export type { ConnectionStatus, ConnectionState };
