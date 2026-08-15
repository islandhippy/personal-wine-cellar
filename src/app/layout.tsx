import type { Metadata, Viewport } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "My Cellar",
    template: "%s · My Cellar",
  },
  description: "A private personal wine cellar and wine diary.",
  applicationName: "My Cellar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "My Cellar",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f6f0e6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
