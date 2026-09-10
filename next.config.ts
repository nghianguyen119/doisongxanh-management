import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Zalo CDN hosts for attachment thumbnails sent by employees.
    remotePatterns: [
      { protocol: "https", hostname: "**.zadn.vn" },
      { protocol: "https", hostname: "**.zaloapp.com" },
      { protocol: "https", hostname: "**.zdn.vn" },
    ],
  },
};

export default nextConfig;
