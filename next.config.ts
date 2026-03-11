import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@metamask/sdk', '@wagmi/connectors'],
};

export default nextConfig;
