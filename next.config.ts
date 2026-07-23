import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows loading the dev server from a phone on the same LAN for testing.
  // Use the Mac's mDNS hostname, not a raw LAN IP — DHCP reassigns the IP
  // periodically (this value has gone stale twice already), but the .local
  // hostname stays constant across renewals.
  allowedDevOrigins: ["Eastons-MacBook-Air-7.local", "192.168.86.33"],
};

export default nextConfig;
