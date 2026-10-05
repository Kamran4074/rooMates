import type { NextConfig } from "next";

// Your machine's Wi-Fi IP (e.g. 192.168.1.39), set in .env, lets others on the
// same router open the dev server at http://<that IP>:3000.
const lanHost = process.env.DEV_LAN_HOST;

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHost ? [lanHost] : [],
  // Hides the floating "N" dev-tools badge; compile/runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
