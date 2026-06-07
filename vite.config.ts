import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://sbmvxjzwqdwpuxcajlpq.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibXZ4anp3cWR3cHV4Y2FqbHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDQ4NTMsImV4cCI6MjA3OTAyMDg1M30.AlnAoBzA1K_RFd0n08y8RcNtEDSbCbn31-2e6XvgbX0'),
    },
  };
});
