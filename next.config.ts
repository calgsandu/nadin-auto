import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/crm/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
        ],
      },
    ];
  },
  // Fonturile PDF sunt citite cu fs la runtime; include-le în output tracing.
  outputFileTracingIncludes: {
    "/api/export/**": ["./src/assets/fonts/*.ttf"],
  },
};

export default nextConfig;
