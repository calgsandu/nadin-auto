import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/catalog", "/ru/catalog"],
      disallow: ["/crm", "/auth"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
