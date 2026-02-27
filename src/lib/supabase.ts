import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'attendance-app',
    },
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      });
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

async function testSupabaseReachability(): Promise<{ reachable: boolean; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok || response.status === 404) {
      return { reachable: true };
    }

    return {
      reachable: false,
      error: `Server returned status ${response.status}`
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          reachable: false,
          error: 'Connection timeout - Mobile network may be blocking access'
        };
      }
      return {
        reachable: false,
        error: `Network error: ${err.message}`
      };
    }

    return {
      reachable: false,
      error: 'Unknown connection error'
    };
  }
}

export async function testConnection(retries = 2) {
  console.log('Testing Supabase connection...');

  const reachabilityTest = await testSupabaseReachability();

  if (!reachabilityTest.reachable) {
    console.error('Supabase not reachable:', reachabilityTest.error);
    return {
      success: false,
      error: reachabilityTest.error || 'Cannot reach Supabase server',
      diagnostic: {
        url: supabaseUrl,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      }
    };
  }

  console.log('Supabase is reachable, testing database query...');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Query attempt ${attempt + 1}/${retries + 1}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const { data, error } = await supabase
        .from('employees')
        .select('count')
        .limit(1)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error(`Query attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          return {
            success: false,
            error: `Database query failed: ${error.message}`,
            diagnostic: {
              code: error.code,
              details: error.details,
              hint: error.hint,
            }
          };
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      console.log('Connection test successful!');
      return { success: true, data };

    } catch (err) {
      console.error(`Query attempt ${attempt + 1} exception:`, err);

      if (attempt === retries) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return {
          success: false,
          error: `Connection failed after ${retries + 1} attempts: ${errorMessage}`,
          diagnostic: {
            lastError: errorMessage,
            attempts: retries + 1,
          }
        };
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return {
    success: false,
    error: 'Maximum retry attempts reached'
  };
}
