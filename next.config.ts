import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow API responses to exceed the default 4MB body size limit
  // (TTS audio can be large for long responses)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Empty turbopack config silences the "no turbopack config" warning in Next.js 16
  turbopack: {},
};

export default nextConfig;
