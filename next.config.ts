import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet expose son code en ESM ; sur Next 16 le bundling de
  // certaines libs map nécessite une transpile explicite côté server graph.
  transpilePackages: ["react-leaflet", "@react-leaflet/core", "leaflet"],
  // Autorise l'accès aux ressources dev (/_next/*) depuis les tunnels
  // cloudflared utilisés pour les démos externes (scripts/demo*.sh).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
