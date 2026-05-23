import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow the app to be embedded as an iframe inside the Circles miniapp host.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },

  webpack: (
    config: { resolve: { fallback: Record<string, boolean> } },
    { isServer }: { isServer: boolean }
  ) => {
    // Only stub out Node built-ins for the *client* (browser) bundle.
    // Server-side API routes use real Node.js fs/net/tls — never stub them.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
