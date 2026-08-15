import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Cellar",
    short_name: "My Cellar",
    description: "A private personal wine cellar and wine diary.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f0e6",
    theme_color: "#f6f0e6",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
