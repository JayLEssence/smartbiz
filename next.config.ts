import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header
  typescript: {
    ignoreBuildErrors: true, // Keep for development speed
  },
};

export default nextConfig;
