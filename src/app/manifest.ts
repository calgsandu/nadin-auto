import type { MetadataRoute } from "next";

/**
 * CRM-ul se poate instala ca aplicație (Chrome/Edge: „Instalează", iPhone:
 * „Adaugă pe ecranul principal"): fereastră proprie, fără bara browserului,
 * pornește direct în Produse.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nadin Auto",
    short_name: "Nadin Auto",
    description: "Catalog, stoc și vânzări Nadin Auto",
    lang: "ro",
    start_url: "/crm/produse",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#f4f4f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcuts: [
      { name: "Vânzare nouă", url: "/crm/vanzari?nou=1" },
      { name: "Produse", url: "/crm/produse" },
    ],
  };
}
