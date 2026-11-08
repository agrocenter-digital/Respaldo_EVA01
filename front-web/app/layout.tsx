import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Metadatos estáticos: `output: "export"` no permite usar `headers()` en el build.
export const metadata: Metadata = {
  title: { default: "AgroCenter Digital", template: "%s | AgroCenter Digital" },
  description: "Plataforma operativa para compras, ventas e inventario de AgroCenter.",
  openGraph: {
    title: "AgroCenter Digital",
    description: "Compras, ventas e inventario bajo control.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "AgroCenter Digital" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgroCenter Digital",
    description: "Compras, ventas e inventario bajo control.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
