import type { MetadataRoute } from "next";

/** Web app manifest: lets phones install OSES-J as a standalone app (home-screen icon, no browser chrome). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OSES-J",
    short_name: "OSES-J",
    description: "AI-powered social export sales system",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Search leads", url: "/leads/search", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Inbox", url: "/inbox", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Clients", url: "/clients", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
