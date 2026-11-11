import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home Screen"): opens full screen with its own icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Manager",
    short_name: "Money",
    description: "ບັນທຶກລາຍຮັບ ລາຍຈ່າຍ ແລະ ເບິ່ງລາຍງານ",
    lang: "lo",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f2",
    theme_color: "#28578a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "ບັນທຶກ", url: "/entry", icons: [{ src: "/icon-192.png", sizes: "192x192" }] }],
  };
}
