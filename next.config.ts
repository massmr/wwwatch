import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // FUTURE(maintainer, 2026-07-01): enable experimental.dynamicIO once 'use cache'
  // is confirmed stable in this Next build (see app/journal/[date]/[slug]/page.tsx).
};

export default nextConfig;
