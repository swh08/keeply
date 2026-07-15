import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Keeply",
    short_name: "Keeply",
    description: "Keep every possession in order",
    start_url: "/zh-CN/app/home",
    scope: "/",
    display: "standalone",
    background_color: "#F6F7F5",
    theme_color: "#526E63",
    orientation: "any",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "添加物品", short_name: "添加", url: "/zh-CN/app/items/new", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
      { name: "全部物品", short_name: "物品", url: "/zh-CN/app/items", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
