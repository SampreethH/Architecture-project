import type { NextConfig } from "next";

const API = process.env.CADENCE_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  async rewrites() {
    return [{ source: "/cad-api/:path*", destination: `${API}/:path*` }];
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
