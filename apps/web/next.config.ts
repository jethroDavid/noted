import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg"],
  transpilePackages: ["@noted/contracts", "@noted/database"],
};

export default nextConfig;
