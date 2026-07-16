import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "incoresports.koszulker.pl",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "teamprinted.pl",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;
