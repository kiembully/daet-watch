import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose"],
  experimental: {
    // Revisiting a tab you were just on should paint from the client cache
    // instead of re-running the query: dynamic stays fresh for 30s, static for
    // 3 minutes. New data still arrives on the next hard navigation.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Issue photos are served straight from Cloudinary's CDN with its own
  // transformations (f_auto,q_auto,w_*), so Next's optimizer would only add a
  // second, slower hop. Plain <img> with explicit width/height is deliberate.
  async headers() {
    return [
      {
        // A cached service worker is a service worker that never updates.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
