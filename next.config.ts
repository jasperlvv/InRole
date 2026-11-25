import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@ffprobe-installer/ffprobe"],
  images: { localPatterns: [{ pathname: "/brand/**", search: "" }, { pathname: "/people/**", search: "" }] },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
