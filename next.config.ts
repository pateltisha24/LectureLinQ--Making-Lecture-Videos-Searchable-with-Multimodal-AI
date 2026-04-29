import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static ships a native binary; bundling rewrites __dirname and
  // breaks the binary path. Keep it external so it loads from node_modules.
  serverExternalPackages: ["ffmpeg-static"],
  experimental: {
    serverActions: { bodySizeLimit: "2gb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.twelvelabs.io",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
    ],
  },
};

export default nextConfig;
