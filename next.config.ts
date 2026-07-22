import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows loading the dev server from a phone on the same LAN for testing.
  allowedDevOrigins: ["192.168.86.29"],
};

export default nextConfig;
