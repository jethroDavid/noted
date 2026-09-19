import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg"],
  transpilePackages: [
    "@noted/contracts",
    "@noted/api-client",
    "@noted/database",
    "@noted/domain",
    "@noted/fridge-ui",
    "@noted/server",
  ],
};

export default nextConfig;
