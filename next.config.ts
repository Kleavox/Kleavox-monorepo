import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ["fast-geoip"],

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
