import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Fonturile PDF sunt citite cu fs la runtime; include-le în output tracing.
  outputFileTracingIncludes: {
    "/api/export/**": ["./src/assets/fonts/*.ttf"],
  },
};

export default nextConfig;
