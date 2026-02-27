interface QueuedRequest {
  id: string;
  operation: () => Promise<any>;
  retries: number;
  maxRetries: number;
  timestamp: Date;
  metadata?: any;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private storageKey = 'attendance-request-queue';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        console.log('Loaded queued requests from storage:', data.length);
      }
    } catch (error) {
      console.error('Failed to load request queue:', error);
    }
  }

  private saveToStorage() {
    try {
      const metadata = this.queue.map(req => ({
        id: req.id,
        retries: req.retries,
        timestamp: req.timestamp,
        metadata: req.metadata,
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save request queue:', error);
    }
  }

  add(operation: () => Promise<any>, maxRetries = 3, metadata?: any): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: QueuedRequest = {
      id,
      operation,
      retries: 0,
      maxRetries,
      timestamp: new Date(),
      metadata,
    };

    this.queue.push(request);
    this.saveToStorage();

    console.log(`Queued request ${id}:`, metadata);

    if (!this.processing) {
      this.processQueue();
    }

    return id;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        console.log(`Processing queued request ${request.id}, attempt ${request.retries + 1}/${request.maxRetries}`);

        await request.operation();

        console.log(`Successfully processed request ${request.id}`);
        this.queue.shift();
        this.saveToStorage();

      } catch (error) {
        console.error(`Failed to process request ${request.id}:`, error);

        request.retries++;

        if (request.retries >= request.maxRetries) {
          console.error(`Request ${request.id} exceeded max retries, removing from queue`);
          this.queue.shift();
          this.saveToStorage();
        } else {
          console.log(`Will retry request ${request.id} later`);
          await new Promise(resolve => setTimeout(resolve, 2000 * request.retries));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this.saveToStorage();
  }

  retry() {
    if (!this.processing && this.queue.length > 0) {
      this.processQueue();
    }
  }
}

export const requestQueue = new RequestQueue();
