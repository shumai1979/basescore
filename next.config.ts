import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@metamask/sdk",
    "@wagmi/connectors",
  ],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
