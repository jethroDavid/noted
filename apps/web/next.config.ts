import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg"],
  transpilePackages: [
    "@noted/contracts",
    "@noted/database",
    "@noted/domain",
    "@noted/fridge-ui",
  ],
};

export default nextConfig;
