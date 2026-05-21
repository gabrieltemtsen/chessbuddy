import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow the app to be embedded as an iframe inside the Circles miniapp host.
  // Next.js defaults to X-Frame-Options: SAMEORIGIN which blocks cross-origin iframes.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Remove the sameorigin restriction so the Circles host can embed us
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // Modern equivalent — allow any origin to embed (safe for a public dApp)
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },

  webpack: (config: { resolve: { fallback: Record<string, boolean> } }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
