import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SWRegister } from "@/components/SWRegister";
import { Analytics } from "@vercel/analytics/next";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap"
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Beauty Price Checker",
  description:
    "Cek harga reguler & flash sale Beauty lewat scan barcode, input SKU, atau nama produk.",
  applicationName: "Beauty Price Checker",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Beauty Price",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101014"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${outfit.variable} ${jbMono.variable} antialiased`}>
        {children}
        <SWRegister />
        <Analytics />
      </body>
    </html>
  );
}
