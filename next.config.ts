import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/", destination: "/me/dashboard", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/__probe", destination: "/api/probe" }];
  },
};

export default nextConfig;
