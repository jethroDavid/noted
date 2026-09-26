import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@noted/api",
    "@noted/auth",
    "@noted/db",
    "@noted/ui",
    "@noted/validators",
  ],
};

export default config;
