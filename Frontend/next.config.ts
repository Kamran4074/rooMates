import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.18.0.1"],
  // Hides the floating "N" dev-tools badge; compile/runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
