import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { SWRegister } from "@/components/SWRegister";
import { Analytics } from "@vercel/analytics/next";

// Display: Bricolage Grotesque — grotesk berkarakter untuk judul & wordmark
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap"
});

// Body: Instrument Sans — bersih tapi tetap punya watak, bukan default generik
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap"
});

// Angka & kode: Spline Sans Mono — mono hangat dengan tabular figures
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline",
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
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: "/icons/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdf9f4"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${bricolage.variable} ${instrument.variable} ${splineMono.variable} antialiased`}>
        {children}
        <SWRegister />
        <Analytics />
      </body>
    </html>
  );
}
