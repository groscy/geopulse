import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GeoPulse frontend — local-first (NFR-1): no external hosts required at runtime.
// Fonts are self-hosted via @fontsource; no CDN.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
});
