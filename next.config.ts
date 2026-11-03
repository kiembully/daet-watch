import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose"],
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
