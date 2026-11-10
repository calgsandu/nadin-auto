import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Editarea Inventarului #1 (955 linii) trimite ~830 KB; limita implicită de
    // 1 MB l-ar fi blocat pe la ~1.150 de linii. Vercel acceptă până la 4,5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
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
