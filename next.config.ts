import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-leaflet expose son code en ESM ; sur Next 16 le bundling de
  // certaines libs map nécessite une transpile explicite côté server graph.
  transpilePackages: ["react-leaflet", "@react-leaflet/core", "leaflet"],
};

export default nextConfig;
